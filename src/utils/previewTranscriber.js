export class PreviewAudioTranscriber {
  static async transcribe(previewUrl, timeoutMs = 12000) {
    if (!previewUrl) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(previewUrl, { signal: controller.signal });
      if (!response.ok) return null;
      const encoded = await response.arrayBuffer();

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      const context = new AudioContext();
      const decoded = await context.decodeAudioData(encoded.slice(0));
      const pcm = this.downmix(decoded);
      await context.close();

      return this.detectNotes(pcm, decoded.sampleRate);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  static downmix(audioBuffer) {
    const channelCount = audioBuffer.numberOfChannels;
    const data = audioBuffer.getChannelData(0);
    if (channelCount === 1) return data.slice();

    const mix = new Float32Array(data.length);
    for (let channel = 0; channel < channelCount; channel++) {
      const samples = audioBuffer.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) mix[i] += samples[i] / channelCount;
    }
    return mix;
  }

  static resample(samples, sourceRate, targetRate = 11025) {
    if (sourceRate <= targetRate) return samples;
    const ratio = sourceRate / targetRate;
    const output = new Float32Array(Math.floor(samples.length / ratio));
    for (let i = 0; i < output.length; i++) {
      const position = i * ratio;
      const left = Math.floor(position);
      const right = Math.min(samples.length - 1, left + 1);
      const blend = position - left;
      output[i] = samples[left] * (1 - blend) + samples[right] * blend;
    }
    return output;
  }

  static detectPitch(frame, sampleRate) {
    let rms = 0;
    for (let i = 0; i < frame.length; i++) rms += frame[i] * frame[i];
    rms = Math.sqrt(rms / frame.length);
    if (rms < 0.012) return null;

    const minLag = Math.max(2, Math.floor(sampleRate / 1500));
    const maxLag = Math.min(frame.length - 2, Math.floor(sampleRate / 55));
    let bestLag = -1;
    let bestCorrelation = 0.58;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let correlation = 0;
      let leftEnergy = 0;
      let rightEnergy = 0;
      for (let i = 0; i < frame.length - lag; i++) {
        const left = frame[i];
        const right = frame[i + lag];
        correlation += left * right;
        leftEnergy += left * left;
        rightEnergy += right * right;
      }
      const normalized = correlation / Math.sqrt(leftEnergy * rightEnergy + 1e-12);
      if (normalized > bestCorrelation) {
        bestCorrelation = normalized;
        bestLag = lag;
      }
    }

    if (bestLag < 0) return null;
    return sampleRate / bestLag;
  }

  static frequencyToMidi(frequency) {
    if (!frequency || frequency < 55 || frequency > 1500) return null;
    return Math.round(69 + 12 * Math.log2(frequency / 440));
  }

  static detectNotes(pcm, sourceRate) {
    const samples = this.resample(pcm, sourceRate);
    const sampleRate = 11025;
    const frameSize = 1024;
    const hopSize = 512;
    const detected = [];

    for (let offset = 0; offset + frameSize <= samples.length; offset += hopSize) {
      const frame = samples.subarray(offset, offset + frameSize);
      const frequency = this.detectPitch(frame, sampleRate);
      const midi = this.frequencyToMidi(frequency);
      detected.push({
        time: offset / sampleRate,
        midi
      });
    }

    if (!detected.length) return null;

    // Suavizado temporal: elimina octavas falsas y vibratos breves en cada salto.
    const smoothed = detected.map((sample, index) => {
      const neighbors = detected
        .slice(Math.max(0, index - 2), Math.min(detected.length, index + 3))
        .map(item => item.midi)
        .filter(midi => midi !== null);
      if (!neighbors.length) return { ...sample, midi: null };
      neighbors.sort((a, b) => a - b);
      return { ...sample, midi: neighbors[Math.floor(neighbors.length / 2)] };
    });
    detected.splice(0, detected.length, ...smoothed);

    const segments = [];
    let currentMidi = null;
    let segmentStart = 0;

    for (const sample of detected) {
      if (sample.midi !== currentMidi) {
        if (currentMidi !== null) segments.push({ midi: currentMidi, start: segmentStart, end: sample.time });
        currentMidi = sample.midi;
        segmentStart = sample.time;
      }
    }
    if (currentMidi !== null) {
      segments.push({ midi: currentMidi, start: segmentStart, end: detected[detected.length - 1].time });
    }

    const notes = [];
    for (const segment of segments) {
      if (segment.midi < 21 || segment.midi > 108) continue;
      const duration = segment.end - segment.start;
      if (duration < 0.09) continue;

      if (notes.length && segment.midi === notes[notes.length - 1].midi) {
        notes[notes.length - 1].duration += duration;
      } else {
        notes.push({
          note: this.midiToNote(segment.midi),
          duration: Math.min(3, Math.max(0.12, duration)),
          section: 'Preview'
        });
      }
    }

    if (notes.length < 3) return null;

    const energyChanges = detected.reduce((count, item, index) => {
      if (index === 0) return 0;
      return item.midi !== detected[index - 1].midi ? count + 1 : count;
    }, 0);
    const durationSeconds = samples.length / sampleRate;
    const estimatedBpm = Math.max(60, Math.min(180, Math.round((energyChanges / durationSeconds) * 60)));

    return {
      notes,
      bpm: estimatedBpm,
      sourceType: 'preview',
      sourceLabel: 'Free 30-second preview analysis'
    };
  }

  static midiToNote(midi) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
  }
}
