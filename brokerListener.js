//npm insatll mqtt!!!!
import { initializeApp } from "firebase/app"
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore"
import mqtt from 'mqtt'
import dotenv from "dotenv"
dotenv.config()


const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
// Implement correctly:
const brokerUrl = process.env.MQTT_BROKER_URL

const client = mqtt.connect(brokerUrl, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
})





//ställ in korrekt topic
const topic = "ik1332/proj/sensors"

client.on ('connect', () => {
    console.log('Connected to MQTT broker!')

    client.subscribe(topic, (err) => {
        if(!err){
            console.log(`Subscribed to: ${topic}`)
        }
    })
})

//körs varje gång ny message kommer
client.on('message', async (topic, message) => {    
    try{
        console.log(`recieved message on ${topic}: ${message.toString()}`)

        //konverterar buffer till sträng
        const rawData = message.toString()
        const jsonData= JSON.parse(rawData)

        //lägger till i db
        const docRef = await addDoc(collection(db, "sensor_readings"), {
            ...jsonData,
            receivedAt: serverTimestamp(),
            sourceTopic: topic
        })
    } catch(err){
        console.error("failed to process message:", err.message)
    }

    
})