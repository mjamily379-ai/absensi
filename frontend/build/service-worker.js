// frontend/public/service-worker.js

self.addEventListener('push', event => {
  const data = event.data.json();
  console.log('Push notification received:', data);

  const options = {
    body: data.body,
    icon: '/logo192.png', // Optional: use an icon from your public folder
    badge: '/logo192.png' // Optional: for Android
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  // This opens the app's URL in a new browser tab.
  // You can customize this to focus an existing tab if one is open.
  event.waitUntil(
    clients.openWindow('/')
  );
});
