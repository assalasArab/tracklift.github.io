const firebaseConfig = {
  apiKey: "AIzaSyCqaJ3GBXBPa-4LFwL_kUIuQAyTY92ml6o",
  authDomain: "trackliftbdd.firebaseapp.com",
  projectId: "trackliftbdd",
  storageBucket: "trackliftbdd.firebasestorage.app",
  messagingSenderId: "241065219021",
  appId: "1:241065219021:web:b622b63431ab1fd4dbea84",
  measurementId: "G-XYXRH2T31H"
};

/* global firebase */
firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const firestore = firebase.firestore();

// Persistence hors-ligne — les donnees restent dispo sans internet
firestore.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === "failed-precondition") {
    console.warn("Firestore persistence: un seul onglet supporte");
  } else if (err.code === "unimplemented") {
    console.warn("Firestore persistence: navigateur non supporte");
  }
});
