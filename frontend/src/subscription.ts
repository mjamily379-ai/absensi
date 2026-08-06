// frontend/src/subscription.ts

// This function is needed to convert the VAPID public key to a Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeUser(role: string, userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return null;
  }

  try {
    const swRegistration = await navigator.serviceWorker.ready;
    let subscription = await swRegistration.pushManager.getSubscription();

    if (subscription === null) {
      console.log('Not subscribed, creating new subscription');
      const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VAPID public key not found in .env');
        return null;
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
    } else {
      console.log('User is already subscribed.');
    }

    console.log('Sending subscription to backend with role:', role, 'and userId:', userId);
    await fetch(`${process.env.REACT_APP_API_URL}/api/subscribe`, {
      method: 'POST',
      body: JSON.stringify({ subscription, role, userId }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Subscription sent successfully.');
    return subscription;

  } catch (error) {
    console.error('Failed to subscribe the user: ', error);
    return null;
  }
}

export async function unsubscribeUser() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return;
  }

  try {
    const swRegistration = await navigator.serviceWorker.ready;
    const subscription = await swRegistration.pushManager.getSubscription();

    if (subscription) {
      // Notify the backend to remove the subscription
      await fetch(`${process.env.REACT_APP_API_URL}/api/unsubscribe`, {
        method: 'POST',
        body: JSON.stringify({ endpoint: subscription.endpoint }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const unsubscribed = await subscription.unsubscribe();
      if (unsubscribed) {
        console.log('User unsubscribed successfully.');
      } else {
        console.error('Failed to unsubscribe the user.');
      }
    } else {
      console.log('User is not subscribed.');
    }
  } catch (error) {
    console.error('Error unsubscribing user: ', error);
  }
}
