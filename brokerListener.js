import { initializeApp } from "firebase/app";
import { getFirestore, setDoc, doc, serverTimestamp } from "firebase/firestore";
import mqtt from "mqtt";
import dotenv from "dotenv";
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const brokerUrl = process.env.MQTT_BROKER_URL;

const client = mqtt.connect(brokerUrl, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

function pad2(n) {
  return String(n).padStart(2, "0");
}

function timestampTitle(date) {
  const yyyy = date.getUTCFullYear();
  const mm = pad2(date.getUTCMonth() + 1);
  const dd = pad2(date.getUTCDate());
  const hh = pad2(date.getUTCHours());
  const mi = pad2(date.getUTCMinutes());
  const ss = pad2(date.getUTCSeconds());
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}.${ms}Z`;
}

const TOPICS = {
  data: "ik1332/proj/sensors/hiss1/data",
  alarm: "ik1332/proj/sensors/hiss1/alarm",
};

const COLLECTIONS = {
  readings: "sensor_readings",
  alarms: "alarm",
};

const ELEVATOR_ID = "hiss1";

client.on("connect", () => {
  console.log("Connected to MQTT broker!");

  client.subscribe([TOPICS.data, TOPICS.alarm], (err) => {
    if (err) {
      console.error("Subscribe error:", err.message);
      return;
    }
    console.log(`Subscribed to: ${TOPICS.data} and ${TOPICS.alarm}`);
  });
});

client.on("message", async (topic, message) => {
  try {
    const raw = message.toString();
    console.log(`received message on ${topic}: ${raw}`);

    const alarmRef = doc(db, COLLECTIONS.alarms, ELEVATOR_ID);

    // 1) If alarm topic -> stuck = true (only once, no parsing needed)
    if (topic === TOPICS.alarm) {
      await setDoc(
        alarmRef,
        {
          floor: -1
        },
        { merge: true }
      );

      console.log(`Alarm set TRUE: ${COLLECTIONS.alarms}/${ELEVATOR_ID}`);
      return;
    }

    // 2) If data topic -> write reading AND stuck = false (board is alive again)
    if (topic === TOPICS.data) {
      // write the reading like before
      const jsonData = JSON.parse(raw);

      const now = new Date();
      const title = timestampTitle(now);
      const readingRef = doc(db, COLLECTIONS.readings, title);

      await setDoc(readingRef, {
        ...jsonData,
        title,
        clientTimestampMs: now.getTime(),
        receivedAt: serverTimestamp(),
        sourceTopic: topic,
      });

      // clear the alarm
      await setDoc(
        alarmRef,
        {
          floor: 0
        },
        { merge: true }
      );

      console.log(`Wrote reading: ${COLLECTIONS.readings}/${title}`);
      console.log(`Alarm set FALSE: ${COLLECTIONS.alarms}/${ELEVATOR_ID}`);
      return;
    }

    console.warn("Ignoring unexpected topic:", topic);
  } catch (err) {
    console.error("failed to process message:", err.message);
  }
});