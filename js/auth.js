import { auth } from "./firebase-config.js";

/* global firebase */
const googleProvider = new firebase.auth.GoogleAuthProvider();

export const Auth = {
  /** Connexion via popup Google */
  async signInWithGoogle() {
    const result = await auth.signInWithPopup(googleProvider);
    return result.user;
  },

  /** Deconnexion Firebase */
  signOut() {
    return auth.signOut();
  },

  /** Ecoute les changements d'etat (login / logout) */
  onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(callback);
  },

  /** Utilisateur courant (ou null) */
  getCurrentUser() {
    return auth.currentUser;
  }
};
