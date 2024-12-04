// Connect to the server via Socket.io
const socket = io();
let currentRoom = "general"; // Default room

const token = new URLSearchParams(window.location.search).get("token"); //! To get the token from the URL

if (!token) {
  alert("authentication token is missing. please login again");
  window.location.href = "/";
}
// Join the selected room
document.getElementById("join-room").addEventListener("click", () => {
  const roomSelect = document.getElementById("room-select");
  const newRoom = roomSelect.value;
  if (newRoom !== currentRoom) {
    socket.emit("joinRoom", newRoom);
    currentRoom = newRoom;
    document.getElementById("chat-box").innerHTML = ""; // Clear chat box
    console.log(`Joined room: ${newRoom}`);
  }
});

// Listen for incoming messages
socket.on("message", (msg) => {
  const chatBox = document.getElementById("chat-box");
  const messageElement = document.createElement("p");
  messageElement.textContent = msg;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll
});

//!Handle Errors
socket.on("error", (errMsg) => {
  alert(errMsg);
});

// Send messages to the server
const chatForm = document.getElementById("chat-form");
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const messageInput = document.getElementById("message-input");
  const message = messageInput.value;
  if (!message.trim()) {
    return; // Prevents sending empty messages
  }
  console.log("Token being sent:", token);

  socket.emit("chatMessage", { token, room: currentRoom, message });
  messageInput.value = ""; // Clear input field
});
