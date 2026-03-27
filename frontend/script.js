async function sendMessage() {
  const input = document.getElementById("input");
  const chat = document.getElementById("chat");

  const message = input.value;

  if (!message) return;

  // user message
  chat.innerHTML += `<div class="user">${message}</div>`;

  // loading
  const loading = document.createElement("div");
  loading.className = "bot";
  loading.innerText = "AI is typing...";
  chat.appendChild(loading);

  try {
    const res = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    const data = await res.json();

    loading.remove();

    // AI response
    chat.innerHTML += `<div class="bot">${data.reply}</div>`;
  } catch (err) {
    loading.innerText = "Error connecting to server";
  }

  input.value = "";
  chat.scrollTop = chat.scrollHeight;
}