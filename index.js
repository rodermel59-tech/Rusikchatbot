let currentCharacter = "Заботливый помощник";
let currentMood = "Счастливое";

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Бот активен", { status: 200 });
    }

    try {
      const payload = await request.json();
      
      if (payload.message) {
        const chatId = payload.message.chat.id;
        const text = payload.message.text || "";
        const username = payload.message.from.first_name || "Участник семьи";

        if (text.startsWith("/start")) {
          await sendMainMenu(chatId, env);
          return new Response("OK", { status: 200 });
        }

        await sendTyping(chatId, env);
        const aiResponse = await callGeminiWithPersonality(text, username, env);
        await sendMessage(chatId, aiResponse, env);
      }

      if (payload.callback_query) {
        const query = payload.callback_query;
        const chatId = query.message.chat.id;
        const data = query.data;

        await answerCallbackQuery(query.id, env);

        if (data === "menu_vote") {
          await sendPoll(chatId, env);
        } else if (data === "menu_buy") {
          await sendShoppingList(chatId, env);
        } else if (data === "menu_settings") {
          await sendSettingsMenu(chatId, env);
        } else if (data === "set_char_menu") {
          await sendCharacterMenu(chatId, env);
        } else if (data === "set_mood_menu") {
          await sendMoodMenu(chatId, env);
        } else if (data.startsWith("char_")) {
          const charMap = {
            char_kind: "Заботливый помощник",
            char_strict: "Строгий критик",
            char_sarc: "Саркастичный шутник",
            char_funny: "Веселый добряк"
          };
          currentCharacter = charMap[data] || currentCharacter;
          await sendMessage(chatId, `⚙️ *Характер изменен на:* *${currentCharacter}*`, env);
          await sendMainMenu(chatId, env);
        } else if (data.startsWith("mood_")) {
          const moodMap = {
            mood_happy: "Счастливое",
            mood_tired: "Уставшее (хочет кофе)",
            mood_energetic: "Бодрое и гиперактивное"
          };
          currentMood = moodMap[data] || currentMood;
          await sendMessage(chatId, `⚙️ *Настроение изменено на:* *${currentMood}*`, env);
          await sendMainMenu(chatId, env);
        } else if (data === "back_to_main") {
          await sendMainMenu(chatId, env);
        }
      }

    } catch (err) {
      return new Response(err.toString(), { status: 500 });
    }

    return new Response("OK", { status: 200 });
  }
};

async function sendMainMenu(chatId, env) {
  const keyboard = {
    inline_keyboard: [
      [{ text: "🗳️ Голосование", callback_data: "menu_vote" }, { text: "🛒 Покупки", callback_data: "menu_buy" }],
      [{ text: "⚙️ Настройки Бота", callback_data: "menu_settings" }]
    ]
  };
  await fetch(`https://telegram.org{env.TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🤖 *Семейный бот на связи!*\n\n🎭 Характер: *${currentCharacter}*\n❤️ Настроение: *${currentMood}*\n\nЗадай вопрос ИИ или выбери функцию:`,
      reply_markup: keyboard,
      parse_mode: "Markdown"
    })
  });
}

async function sendSettingsMenu(chatId, env) {
  const keyboard = {
    inline_keyboard: [
      [{ text: "🎭 Изменить Характер", callback_data: "set_char_menu" }, { text: "❤️ Изменить Настроение", callback_data: "set_mood_menu" }],
      [{ text: "⬅️ Назад в меню", callback_data: "back_to_main" }]
    ]
  };
  await sendMessage(chatId, "⚙️ *Настройки бота:*", env, keyboard);
}

async function sendCharacterMenu(chatId, env) {
  const keyboard = {
    inline_keyboard: [
      [{ text: "😇 Заботливый", callback_data: "char_kind" }, { text: "🕶️ Строгий", callback_data: "char_strict" }],
      [{ text: "😏 Саркастичный", callback_data: "char_sarc" }, { text: "🤪 Веселый", callback_data: "char_funny" }],
      [{ text: "⬅️ Отмена", callback_data: "menu_settings" }]
    ]
  };
  await sendMessage(chatId, "🎭 *Выберите характер для ИИ:*", env, keyboard);
}

async function sendMoodMenu(chatId, env) {
  const keyboard = {
    inline_keyboard: [
      [{ text: "☀️ Счастливое", callback_data: "mood_happy" }],
      [{ text: "☕ Уставшее", callback_data: "mood_tired" }],
      [{ text: "⚡ Бодрое", callback_data: "mood_energetic" }],
      [{ text: "⬅️ Отмена", callback_data: "menu_settings" }]
    ]
  };
  await sendMessage(chatId, "❤️ *Выберите настроение ИИ:*", env, keyboard);
}

async function callGeminiWithPersonality(prompt, username, env) {
  try {
    const url = `https://googleapis.com{env.GEMINI_API_KEY}`;
    const systemInstruction = `Ты — умный семейный чат-бот. К тебе обратился участник семьи по имени ${username}. Твой текущий характер: ${currentCharacter}. Твое текущее настроение: ${currentMood}. Отвечай на русском языке, обязательно используй имя ${username} в диалоге, подстраивай свой тон под выбранный характер и настроение. Пиши емко.`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\nЗапрос: ${prompt}` }] }]
      })
    });
    const json = await response.json();
    return json.candidates[0].content.parts[0].text;
  } catch (e) {
    return `Привет, ${username}! Не удалось связаться с моим ИИ-мозгом.`;
  }
}

async function sendPoll(chatId, env) {
  await fetch(`https://telegram.org{env.TELEGRAM_TOKEN}/sendPoll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      question: "Семейное голосование: Что готовим на ужин?",
      options: JSON.stringify(["🍕 Пицца", "🍲 Суп", "🥗 Салат"]),
      is_anonymous: false
    })
  });
}

async function sendShoppingList(chatId, env) {
  const keyboard = { inline_keyboard: [[{ text: "⬅️ Меню", callback_data: "back_to_main" }]] };
  await sendMessage(chatId, "🛒 *Список покупок пуст.*", env, keyboard);
}

async function sendMessage(chatId, text, env, keyboard = null) {
  const body = { chat_id: chatId, text: text, parse_mode: "Markdown" };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(`https://telegram.org{env.TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function sendTyping(chatId, env) {
  await fetch(`https://telegram.org{env.TELEGRAM_TOKEN}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" })
  });
}

async function answerCallbackQuery(callbackQueryId, env) {
  await fetch(`https://telegram.org{env.TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId })
  });
}
