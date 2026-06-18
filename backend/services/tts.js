import axios from "axios";
import dotenv from "dotenv";
import fs from "fs/promises";
import {exec} from "child_process";
import {promisify} from "util";

dotenv.config();

const TTS_URL = "https://api.tts.ai/v1/tts/";
const RESULTS_URL = "https://api.tts.ai/v1/speech/results/";

const SPEAKER_VOICES = {
  Marcus: "am_adam",
  Alex: "bm_george", //"am_echo",
  Sarah: "af_bella"
};

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: process.env.TTS_AI_KEY
      ? `Bearer ${process.env.TTS_AI_KEY}`
      : undefined
  };
}


const execAsync=promisify(exec);
async function getMp3Duration(buffer){

    const file="data/temp.mp3";

    await fs.writeFile(file,buffer);

    const {stdout}=await execAsync(
        `ffprobe -v error \
-show_entries format=duration \
-of default=noprint_wrappers=1:nokey=1 ${file}`
    );

    await fs.unlink(file);

    return Number(stdout);
}

async function waitForResult(uuid) {
  for (let i = 0; i < 30; i++) {
    const res = await axios.get(RESULTS_URL, {
      params: { uuid },
      headers: authHeaders()
    });

    if (res.data.status === "completed") {
      return res.data.result_url;
    }

    if (res.data.status === "failed") {
      throw new Error("TTS job failed");
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  throw new Error("TTS timeout");
}

export async function textToSpeech(text, voice = "af_bella") {
  try {
    const submit = await axios.post(
      TTS_URL,
      {
        model: "kokoro",
        text,
        voice,
        format: "mp3"
      },
      { headers: authHeaders() }
    );

    const resultUrl = submit.data.status === "completed"
        ? submit.data.result_url
        : await waitForResult(submit.data.uuid);

    const audio = await axios.get(resultUrl, {
      responseType: "arraybuffer"
    });
    const buffer = Buffer.from(audio.data);

    // const metadata = await parseBuffer(
    //     buffer,
    //     "audio/mpeg"
    // );

    // console.log(metadata.format);
    const duration=await getMp3Duration(buffer);

    return {
        audio: buffer,
        duration: duration
    };

  } catch (err) {
    console.log("TTS error:", err.message);
    return null;
  }
}

export async function speakLine(speaker, text) {
  const voice = SPEAKER_VOICES[speaker] || "af_bella";

  return textToSpeech(text, voice);
}
