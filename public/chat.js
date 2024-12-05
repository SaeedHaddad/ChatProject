const socket = io();
let currentRoom = "general";

const token = new URLSearchParams(window.location.search).get("token");

if (!token) {
  alert("Authentication token is missing. Please login again.");
  window.location.href = "/";
}

// Join the selected room
document.getElementById("join-room").addEventListener("click", () => {
  const roomSelect = document.getElementById("room-select");
  const newRoom = roomSelect.value;
  if (newRoom !== currentRoom) {
    socket.emit("joinRoom", newRoom); // Join new room
    currentRoom = newRoom;
    document.getElementById("chat-box").innerHTML = ""; // Clear chat box
    console.log(`Joined room: ${newRoom}`);
  }
});

// Listen for all messages, including new ones and system messages
socket.on("message", ({ username, message, timestamp, system }) => {
  const chatBox = document.getElementById("chat-box");
  const messageElement = document.createElement("p");
  messageElement.innerHTML = system
    ? `<em>${message}</em> <small>${new Date(
        timestamp
      ).toLocaleTimeString()}</small>`
    : `<strong>${username}</strong>: ${message} <small>${new Date(
        timestamp
      ).toLocaleTimeString()}</small>`;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll
});

// Display all previous messages when joining a room or refreshing
socket.on("previousMessages", (messages) => {
  const chatBox = document.getElementById("chat-box");
  chatBox.innerHTML = ""; // Clear chat box

  // Display all previous messages
  messages.forEach(({ username, message, timestamp }) => {
    const messageElement = document.createElement("p");
    messageElement.innerHTML = `<strong>${username}</strong>: ${message} <small>${new Date(
      timestamp
    ).toLocaleTimeString()}</small>`;
    chatBox.appendChild(messageElement);
  });

  chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll
});

// Send a message to the server
const chatForm = document.getElementById("chat-form");
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const messageInput = document.getElementById("message-input");
  const message = messageInput.value.trim();
  if (!message) return;

  socket.emit("chatMessage", { token, room: currentRoom, message });
  messageInput.value = ""; // Clear input field
});

// Join the room and fetch all messages on page load
window.addEventListener("load", () => {
  socket.emit("joinRoom", currentRoom);
});

// Handle errors
socket.on("error", (errMsg) => {
  alert(errMsg);
});
