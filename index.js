let currentCharacter = "Заботливый помощник";
let currentMood = "Счастливое";

// Временно оставляем токен здесь
const TELEGRAM_TOKEN = "9210024994:AAEy_Pts127SEhUBw8eQnO_9iVKTaMsE4sE";
const TELEGRAM_API = "https://api.telegram.org/bot${TELEGRAM_TOKEN}";

export default {
async fetch(request, env, ctx) {
if (request.method !== "POST") {
return new Response("Семейный бот работает!", { status: 200 });
}

try {
  const payload = await request.json();

  if (payload.message) {
    const message = payload.message;
    const chatId = message.chat.id;
    const text = message.text || "";
    const username = message.from?.first_name || "Участник семьи";

    if (text.startsWith("/start")) {
      await sendMainMenu(chatId);
      return new Response("OK");
    }

    if (!text.trim()) return new Response("OK");

    await sendTyping(chatId);

    const answer = await callGemini(text, username, env);

    await sendMessage(chatId, answer);
  }

  if (payload.callback_query) {
    const query = payload.callback_query;
    const chatId = query.message.chat.id;
    const data = query.data;

    await answerCallbackQuery(query.id);

    if (data === "menu_vote") {
      await sendPoll(chatId);
    }

    else if (data === "menu_buy") {
      await sendShoppingList(chatId);
    }

    else if (data === "menu_settings") {
      await sendSettingsMenu(chatId);
    }

    else if (data === "set_char_menu") {
      await sendCharacterMenu(chatId);
    }

    else if (data === "set_mood_menu") {
      await sendMoodMenu(chatId);
    }

    else if (data.startsWith("char_")) {
      const characters = {
        char_kind: "Заботливый помощник",
        char_strict: "Строгий критик",
        char_sarc: "Саркастичный шутник",
        char_funny: "Веселый добряк"
      };

      currentCharacter = characters[data] || currentCharacter;

      await sendMessage(chatId, `🎭 Характер изменён: ${currentCharacter}`);
      await sendMainMenu(chatId);
    }

    else if (data.startsWith("mood_")) {
      const moods = {
        mood_happy: "Счастливое",
        mood_tired: "Уставшее",
        mood_energetic: "Бодрое и гиперактивное"
      };

      currentMood = moods[data] || currentMood;

      await sendMessage(chatId, `❤️ Настроение изменено: ${currentMood}`);
      await sendMainMenu(chatId);
    }

    else if (data === "back_to_main") {
      await sendMainMenu(chatId);
    }
  }

  return new Response("OK");

} catch (error) {
  console.error("ОШИБКА БОТА:", error.stack || error);

  return new Response("Ошибка: " + error.message, {
    status: 500
  });
}

}
};

// ГЛАВНОЕ МЕНЮ

async function sendMainMenu(chatId) {
const keyboard = {
inline_keyboard: [
[
{ text: "🗳️ Голосование", callback_data: "menu_vote" },
{ text: "🛒 Покупки", callback_data: "menu_buy" }
],
[
{ text: "⚙️ Настройки бота", callback_data: "menu_settings" }
]
]
};

await sendMessage(
chatId,
`🤖 Семейный бот на связи!

🎭 Характер: ${currentCharacter}
❤️ Настроение: ${currentMood}

Задай вопрос ИИ или выбери функцию:`,
keyboard
);
}

// НАСТРОЙКИ

async function sendSettingsMenu(chatId) {
const keyboard = {
inline_keyboard: [
[
{ text: "🎭 Изменить характер", callback_data: "set_char_menu" }
],
[
{ text: "❤️ Изменить настроение", callback_data: "set_mood_menu" }
],
[
{ text: "⬅️ Назад", callback_data: "back_to_main" }
]
]
};

await sendMessage(chatId, "⚙️ Настройки бота:", keyboard);
}

// ВЫБОР ХАРАКТЕРА

async function sendCharacterMenu(chatId) {
const keyboard = {
inline_keyboard: [
[
{ text: "😇 Заботливый", callback_data: "char_kind" },
{ text: "🕶️ Строгий", callback_data: "char_strict" }
],
[
{ text: "😏 Саркастичный", callback_data: "char_sarc" },
{ text: "🤪 Весёлый", callback_data: "char_funny" }
],
[
{ text: "⬅️ Назад", callback_data: "menu_settings" }
]
]
};

await sendMessage(chatId, "🎭 Выбери характер ИИ:", keyboard);
}

// ВЫБОР НАСТРОЕНИЯ

async function sendMoodMenu(chatId) {
const keyboard = {
inline_keyboard: [
[{ text: "☀️ Счастливое", callback_data: "mood_happy" }],
[{ text: "☕ Уставшее", callback_data: "mood_tired" }],
[{ text: "⚡ Бодрое", callback_data: "mood_energetic" }],
[{ text: "⬅️ Назад", callback_data: "menu_settings" }]
]
};

await sendMessage(chatId, "❤️ Выбери настроение ИИ:", keyboard);
}

// ПОДКЛЮЧЕНИЕ GEMINI

async function callGemini(prompt, username, env) {
try {
const url =
"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}";

const systemInstruction = `

Ты — семейный ИИ-помощник.

Сейчас с тобой общается ${username}.

Твой характер: ${currentCharacter}.
Твоё настроение: ${currentMood}.

Общайся на русском языке.
Учитывай выбранный характер и настроение.
Будь естественным, дружелюбным и внимательным.
Не используй имя собеседника в каждом сообщении.
Отвечай понятно и по существу.
`;

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ]
  })
});

const result = await response.json();

if (!response.ok) {
  return "Ошибка Gemini: " +
    (result.error?.message || "неизвестная ошибка");
}

return result.candidates?.[0]?.content?.parts
  ?.map(part => part.text || "")
  .join("") || "Не удалось получить ответ.";

} catch (error) {
return "Не удалось связаться с ИИ. Попробуй ещё раз.";
}
}

// ГОЛОСОВАНИЕ

async function sendPoll(chatId) {
await telegram("sendPoll", {
chat_id: chatId,
question: "🍽️ Что готовим сегодня на ужин?",
options: ["🍕 Пицца", "🍲 Суп", "🥗 Салат"],
is_anonymous: false
});
}

// СПИСОК ПОКУПОК

async function sendShoppingList(chatId) {
const keyboard = {
inline_keyboard: [
[{ text: "⬅️ Главное меню", callback_data: "back_to_main" }]
]
};

await sendMessage(chatId, "🛒 Список покупок пока пуст.", keyboard);
}

// ОТПРАВКА СООБЩЕНИЙ

async function sendMessage(chatId, text, keyboard = null) {
const body = {
chat_id: chatId,
text: String(text).slice(0, 4000)
};

if (keyboard) {
body.reply_markup = keyboard;
}

await telegram("sendMessage", body);
}

// ИНДИКАТОР ПЕЧАТИ

async function sendTyping(chatId) {
await telegram("sendChatAction", {
chat_id: chatId,
action: "typing"
});
}

// ОТВЕТ НА НАЖАТИЕ КНОПКИ

async function answerCallbackQuery(id) {
await telegram("answerCallbackQuery", {
callback_query_id: id
});
}

// ОБЩАЯ ФУНКЦИЯ TELEGRAM API

async function telegram(method, body) {
const response = await fetch("${TELEGRAM_API}/${method}", {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify(body)
});

return await response.json();
}
