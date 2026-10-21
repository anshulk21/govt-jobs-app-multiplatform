/* Service worker for website push notifications (only registered when FEATURES.webPush is on).
   Firebase shows notifications that arrive while the site is closed; the tap opens fcmOptions.link. */
/* global importScripts, firebase */
const params = new URL(self.location.href).searchParams;
const version = params.get('v') || '12.19.0';
importScripts(`https://www.gstatic.com/firebasejs/${version}/firebase-app-compat.js`);
importScripts(`https://www.gstatic.com/firebasejs/${version}/firebase-messaging-compat.js`);
firebase.initializeApp(JSON.parse(params.get('config') || '{}'));
firebase.messaging();
