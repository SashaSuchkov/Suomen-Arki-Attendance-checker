const firebaseConfig = {
	apiKey: "AIzaSyDu-yk22v3ytaRKbcK7aTYHmBDdeCUP5D0",
	authDomain: "suomenarkiattendance.firebaseapp.com",
	projectId: "suomenarkiattendance",
    storageBucket: "suomenarkiattendance.firebasestorage.app",
    messagingSenderId: "445422420033",
    appId: "1:445422420033:web:3250e790dfdc1f970806c0",
    measurementId: "G-DE2D65QGGE"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
