const socket = io();
let currentRoom = "general"; //* Default room

const token = new URLSearchParams(window.location.search).get("token"); //! To get the token from the URL

if (!token) {
  alert("Authentication token is missing. Please login again.");
  window.location.href = "/";
}

//! Join the selected room
document.getElementById("join-room").addEventListener("click", () => {
  const roomSelect = document.getElementById("room-select");
  const newRoom = roomSelect.value;
  if (newRoom !== currentRoom) {
    socket.emit("joinRoom", newRoom); // Emit the 'joinRoom' event to the server
    currentRoom = newRoom;
    document.getElementById("chat-box").innerHTML = ""; //*? Clear chat box
    console.log(`Joined room: ${newRoom}`);
  }
});

//! Listen for previous messages when joining a room (including on refresh)
socket.on("previousMessages", (messages) => {
  const chatBox = document.getElementById("chat-box");
  chatBox.innerHTML = ""; // Clear the chat box before adding messages

  // Display previous messages
  messages.forEach(({ username, message, timestamp }) => {
    const messageElement = document.createElement("p");
    messageElement.innerHTML = `<strong>${username}</strong>: ${message} <small>${new Date(
      timestamp
    ).toLocaleTimeString()}</small>`;
    chatBox.appendChild(messageElement);
  });

  chatBox.scrollTop = chatBox.scrollHeight; //? Auto-scroll
});

//! Listen for incoming messages
socket.on("message", (msg) => {
  const chatBox = document.getElementById("chat-box");
  const messageElement = document.createElement("p");
  messageElement.textContent = msg;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight; //? Auto-scroll
});

//! Handle Errors
socket.on("error", (errMsg) => {
  alert(errMsg);
});

//! Send messages to the server
const chatForm = document.getElementById("chat-form");
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const messageInput = document.getElementById("message-input");
  const message = messageInput.value;
  if (!message.trim()) {
    return; //? Prevent sending empty messages
  }
  console.log("Token being sent:", token);

  socket.emit("chatMessage", { token, room: currentRoom, message });
  messageInput.value = ""; //? Clear input field
});

//? Fetch previous messages when the page loads (for room persistence)
window.addEventListener("load", () => {
  socket.emit("joinRoom", currentRoom); //* Emit room join event on load to fetch history
});
