const socket = io();
let currentRoom = "general";
const currentUsername = new URLSearchParams(window.location.search).get(
  "username"
);

const token = new URLSearchParams(window.location.search).get("token");

if (!token) {
  alert("Authentication token is missing. Please login again.");
  window.location.href = "/";
}

//! Join the selected room
document.getElementById("join-room").addEventListener("click", () => {
  const roomSelect = document.getElementById("room-select");
  const newRoom = roomSelect.value;
  if (newRoom !== currentRoom) {
    socket.emit("joinRoom", newRoom); //? Notify the server
    currentRoom = newRoom;
    localStorage.setItem("currentRoom", newRoom); //? Save room to local storage
    document.getElementById("chat-box").innerHTML = ""; //? Clear chat box
    console.log(`Joined room: ${newRoom}`);
  }
});

//! Listen for all messages, including new ones and system messages
socket.on("message", ({ username, message, timestamp, system, imageUrl }) => {
  const chatBox = document.getElementById("chat-box");
  const messageContainer = document.createElement("div");
  const messageBubble = document.createElement("div");
  const timestampElement = document.createElement("div");

  messageContainer.classList.add("message-container");

  if (system) {
    messageBubble.classList.add("message", "system");
    messageBubble.innerHTML = `<em>${message}</em>`;
  } else if (username === currentUsername) {
    //! Replace 'currentUsername' with the logged-in user's username
    messageBubble.classList.add("message", "sent");
    messageBubble.innerHTML = `<strong>You:</strong> ${message}`;
  } else {
    messageBubble.classList.add("message", "received");
    messageBubble.innerHTML = `<strong>${username}:</strong> ${message}`;
  }

  if (imageUrl) {
    const imageElement = document.createElement("img");
    imageElement.src = imageUrl;
    imageElement.alt = "Uploaded Image";
    imageElement.style.maxWidth = "200px";
    messageContainer.appendChild(imageElement);
  }

  timestampElement.classList.add("message-timestamp");
  timestampElement.innerText = new Date(timestamp).toLocaleTimeString();

  messageContainer.appendChild(messageBubble);
  messageContainer.appendChild(timestampElement);
  chatBox.appendChild(messageContainer);
  chatBox.scrollTop = chatBox.scrollHeight; //* Auto-scroll to the bottom
});

//! Display all previous messages when joining a room or refreshing
socket.on("previousMessages", (messages) => {
  const chatBox = document.getElementById("chat-box");
  chatBox.innerHTML = ""; //* Clear chat box

  messages.forEach(({ username, message, timestamp, imageUrl }) => {
    const messageContainer = document.createElement("div");
    const messageBubble = document.createElement("div");
    const timestampElement = document.createElement("div");

    messageContainer.classList.add("message-container");

    if (username === "YourUsername") {
      messageBubble.classList.add("message", "sent");
    } else {
      messageBubble.classList.add("message", "received");
      messageBubble.innerHTML = `<strong>${username}:</strong> ${message}`;
    }

    //! Display an image if the message includes an image URL
    if (imageUrl) {
      const imgElement = document.createElement("img");
      imgElement.src = imageUrl; // Image URL from S3
      imgElement.alt = "Uploaded Image";
      imgElement.style.maxWidth = "300px";
      imgElement.style.maxHeight = "300px";
      messageContainer.appendChild(imgElement);
    }

    timestampElement.classList.add("message-timestamp");
    timestampElement.innerText = new Date(timestamp).toLocaleTimeString();

    messageContainer.appendChild(messageBubble);
    messageContainer.appendChild(timestampElement);
    chatBox.appendChild(messageContainer);
  });

  chatBox.scrollTop = chatBox.scrollHeight; //? Auto-scroll
});

//! Send a message to the server
const chatForm = document.getElementById("chat-form");
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const messageInput = document.getElementById("message-input");
  const message = messageInput.value.trim();
  if (!message) return;

  socket.emit("chatMessage", { token, room: currentRoom, message });
  messageInput.value = ""; //? Clear input field
});

//! Handle file uploads
const fileUploadForm = document.getElementById("fileUploadForm");
fileUploadForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const fileInput = document.getElementById("fileInput");
  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  fetch("/upload", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.fileUrl) {
        //! Send a message with the uploaded image URL
        socket.emit("chatMessage", {
          token,
          room: currentRoom,
          message: "Sent an image", //? Placeholder message
          imageUrl: data.fileUrl, //? Image URL from S3
        });
      }
    })
    .catch((error) => {
      console.error("Error uploading file:", error);
    });
});

//! Join the room and fetch all messages on page load
window.addEventListener("load", () => {
  const savedRoom = localStorage.getItem("currentRoom");
  currentRoom = savedRoom || "general"; //! Use saved room or default to 'general'
  document.getElementById("room-select").value = currentRoom; //! Set dropdown to saved room
  socket.emit("joinRoom", currentRoom); //! Join the saved or default room
  console.log(`Rejoined room: ${currentRoom}`);
});

//! Handle errors
socket.on("error", (errMsg) => {
  alert(errMsg);
});
