importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyB2FWOrMbTn7cE3-avI6t5WRcEbpiOE9sY",
    authDomain: "docuextract-q8vaa.firebaseapp.com",
    projectId: "docuextract-q8vaa",
    storageBucket: "docuextract-q8vaa.firebasestorage.app",
    messagingSenderId: "789346423389",
    appId: "1:789346423389:web:8c001d308f52784a4b73b4"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
