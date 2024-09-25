import admin from "./firebase.js";

export const sendTaskNotification = async (token, title, body) => {
  try {
    const message = {
      notification: { title, body },
      token: token,
    };

    const response = await admin.messaging().send(message);
    console.log("Successfully sent message:", response);
    return response;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};
