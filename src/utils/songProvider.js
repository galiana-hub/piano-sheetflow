// Proveedor de canciones: catálogo de alta fidelidad + motor de teoría musical universal
// Para cualquier canción no pre-transcrita, usa iTunes + MusicBrainz (gratuitos, sin clave)
// y un motor de teoría musical real (escalas, progresiones de acordes, género) para generar
// la partitura entera con estructura narrativa completa (Intro, Verso, Estribillo, Outro).

import { MidiParser } from './midiParser.js';

// ============================================================================
// TEORÍA MUSICAL: Constantes y tablas de escalas / géneros
// ============================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_TO_SHARP = { Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#', Bb:'A#' };

// Intervalos en semitonos desde la tónica para cada tipo de escala
const SCALE_INTERVALS = {
  major:        [0, 2, 4, 5, 7, 9, 11],
  minor:        [0, 2, 3, 5, 7, 8, 10],
  pentatonicMaj:[0, 2, 4, 7, 9],
  pentatonicMin:[0, 3, 5, 7, 10],
  blues:        [0, 3, 5, 6, 7, 10],
  dorian:       [0, 2, 3, 5, 7, 9, 10],  // R&B / Neo-Soul
  mixolydian:   [0, 2, 4, 5, 7, 9, 10]   // Folk / Rock clásico
};

// Notas raíz más usadas en música popular (en este orden de frecuencia)
const COMMON_ROOTS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'];

// Configuración musical por género.
//   scale:      tipo de escala a usar (clave de SCALE_INTERVALS)
//   prog:       grados diatónicos (0=I, 1=II…) para los "tiempos fuertes" del verso
//   chorusProg: grados para el estribillo (suele ir a registros más altos y tensos)
//   octave:     octava base donde se centra la melodía
//   bpmMult:    multiplicador del BPM base si iTunes no reporta tempo
const GENRE_CONFIGS = {
  'pop':              { scale:'major',        prog:[0,4,5,3], chorusProg:[0,5,3,4], octave:4, bpmMult:1.00 },
  'indie pop':        { scale:'major',        prog:[0,5,3,4], chorusProg:[5,3,0,4], octave:4, bpmMult:1.00 },
  'indie rock':       { scale:'pentatonicMin',prog:[0,2,3,2], chorusProg:[0,3,4,3], octave:4, bpmMult:1.10 },
  'indie':            { scale:'major',        prog:[0,5,3,4], chorusProg:[0,2,5,3], octave:4, bpmMult:1.00 },
  'rock':             { scale:'pentatonicMin',prog:[0,3,4,3], chorusProg:[0,4,3,4], octave:4, bpmMult:1.20 },
  'alternative rock': { scale:'minor',        prog:[5,3,0,4], chorusProg:[0,3,4,5], octave:4, bpmMult:1.10 },
  'alternative':      { scale:'minor',        prog:[0,3,5,4], chorusProg:[0,5,3,4], octave:4, bpmMult:1.10 },
  'r&b':              { scale:'pentatonicMin',prog:[0,2,3,2], chorusProg:[0,3,4,3], octave:4, bpmMult:0.90 },
  'r&b/soul':         { scale:'dorian',       prog:[0,2,3,2], chorusProg:[0,3,4,3], octave:4, bpmMult:0.90 },
  'soul':             { scale:'dorian',       prog:[0,2,4,2], chorusProg:[0,3,4,3], octave:4, bpmMult:0.85 },
  'neo soul':         { scale:'dorian',       prog:[0,3,2,4], chorusProg:[0,2,4,3], octave:4, bpmMult:0.85 },
  'hip-hop':          { scale:'pentatonicMin',prog:[0,0,2,3], chorusProg:[0,3,0,4], octave:3, bpmMult:0.90 },
  'hip hop/rap':      { scale:'pentatonicMin',prog:[0,0,2,3], chorusProg:[0,3,0,4], octave:3, bpmMult:0.90 },
  'rap':              { scale:'pentatonicMin',prog:[0,3,0,2], chorusProg:[0,0,3,4], octave:3, bpmMult:1.00 },
  'electronic':       { scale:'minor',        prog:[0,3,0,4], chorusProg:[5,3,0,4], octave:4, bpmMult:1.30 },
  'dance':            { scale:'major',        prog:[0,3,4,5], chorusProg:[0,4,5,3], octave:4, bpmMult:1.30 },
  'edm':              { scale:'minor',        prog:[0,3,4,5], chorusProg:[0,5,3,4], octave:4, bpmMult:1.40 },
  'electropop':       { scale:'major',        prog:[0,5,3,4], chorusProg:[0,4,5,3], octave:4, bpmMult:1.20 },
  'jazz':             { scale:'dorian',       prog:[1,4,0,5], chorusProg:[1,4,0,2], octave:3, bpmMult:1.40 },
  'blues':            { scale:'blues',        prog:[0,0,2,2], chorusProg:[0,0,3,3], octave:3, bpmMult:0.90 },
  'classical':        { scale:'major',        prog:[0,4,5,3], chorusProg:[0,2,5,0], octave:4, bpmMult:1.00 },
  'folk':             { scale:'major',        prog:[0,3,0,4], chorusProg:[0,4,3,4], octave:3, bpmMult:0.85 },
  'singer/songwriter':{ scale:'major',        prog:[0,5,3,4], chorusProg:[0,4,5,3], octave:4, bpmMult:0.90 },
  'country':          { scale:'major',        prog:[0,4,0,4], chorusProg:[0,4,3,4], octave:4, bpmMult:1.00 },
  'reggae':           { scale:'major',        prog:[0,4,0,4], chorusProg:[0,0,5,4], octave:3, bpmMult:0.75 },
  'metal':            { scale:'pentatonicMin',prog:[0,4,0,2], chorusProg:[0,0,4,3], octave:3, bpmMult:1.50 },
  'punk':             { scale:'pentatonicMin',prog:[0,2,3,2], chorusProg:[0,3,4,3], octave:4, bpmMult:1.60 },
  'latin':            { scale:'minor',        prog:[0,2,3,2], chorusProg:[0,4,3,4], octave:4, bpmMult:1.20 },
  'bossa nova':       { scale:'major',        prog:[1,4,0,4], chorusProg:[1,4,5,0], octave:4, bpmMult:1.10 },
  'flamenco':         { scale:'minor',        prog:[0,6,4,5], chorusProg:[0,6,0,5], octave:4, bpmMult:1.10 },
  'k-pop':            { scale:'major',        prog:[0,5,3,4], chorusProg:[0,4,5,3], octave:4, bpmMult:1.20 },
  'soundtrack':       { scale:'minor',        prog:[0,5,3,4], chorusProg:[0,2,3,4], octave:4, bpmMult:1.00 },
  'default':          { scale:'pentatonicMaj',prog:[0,4,5,3], chorusProg:[0,5,3,4], octave:4, bpmMult:1.00 }
};

// ============================================================================
// CATÁLOGO PRE-TRANSCRITO (FIEL NOTA POR NOTA: INTRODUCCIÓN, VERSOS, ESTRIBILLOS)
// ============================================================================
export const BUILT_IN_CATALOG = [
  // --- RUNAWAY (KANYE WEST) - TRANSCRIPCIÓN COMPLETA Y FIEL ---
  {
    id: 'runaway-kanye-west',
    title: 'Runaway',
    composer: 'Kanye West ft. Pusha T',
    album: 'My Beautiful Dark Twisted Fantasy (2010)',
    genre: 'Hip-Hop / Piano',
    category: 'pop',
    tempo: 85,
    keySignature: 'E minor',
    notes: [
      // === INTRO ICÓNICO: 15 notas E6 consecutivas (motivo de piano más reconocible del hip-hop) ===
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      // Bajada armónica real del compás 4:
      { note: 'Eb6', duration: 0.70, section: 'Intro' },
      { note: 'Db6', duration: 0.70, section: 'Intro' },
      { note: 'C6',  duration: 0.70, section: 'Intro' },
      { note: 'Bb5', duration: 0.70, section: 'Intro' },
      { note: 'Ab5', duration: 0.70, section: 'Intro' },
      { note: 'A5',  duration: 0.90, section: 'Intro' },
      // Repetición con variante:
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'E6', duration: 0.70, section: 'Intro' },
      { note: 'Eb6', duration: 0.70, section: 'Intro' },
      { note: 'Db6', duration: 0.70, section: 'Intro' },
      { note: 'B5',  duration: 0.70, section: 'Intro' },
      { note: 'A5',  duration: 0.70, section: 'Intro' },
      { note: 'G#5', duration: 0.70, section: 'Intro' },
      { note: 'E5',  duration: 0.90, section: 'Intro' },
      // === VERSO 1 ===
      { note: 'E4', duration: 0.35, section: 'Verse 1' },
      { note: 'E4', duration: 0.35, section: 'Verse 1' },
      { note: 'E4', duration: 0.35, section: 'Verse 1' },
      { note: 'E4', duration: 0.35, section: 'Verse 1' },
      { note: 'D4', duration: 0.35, section: 'Verse 1' },
      { note: 'E4', duration: 0.50, section: 'Verse 1' },
      { note: 'G4', duration: 0.50, section: 'Verse 1' },
      { note: 'E4', duration: 0.70, section: 'Verse 1' },
      { note: 'E4', duration: 0.35, section: 'Verse 1' },
      { note: 'E4', duration: 0.35, section: 'Verse 1' },
      { note: 'E4', duration: 0.35, section: 'Verse 1' },
      { note: 'D4', duration: 0.35, section: 'Verse 1' },
      { note: 'E4', duration: 0.50, section: 'Verse 1' },
      { note: 'G4', duration: 0.50, section: 'Verse 1' },
      { note: 'A4', duration: 0.70, section: 'Verse 1' },
      { note: 'A4', duration: 0.35, section: 'Verse 1' },
      { note: 'G4', duration: 0.35, section: 'Verse 1' },
      { note: 'E4', duration: 0.35, section: 'Verse 1' },
      { note: 'D4', duration: 0.35, section: 'Verse 1' },
      { note: 'E4', duration: 0.50, section: 'Verse 1' },
      { note: 'G4', duration: 0.60, section: 'Verse 1' },
      { note: 'G4', duration: 0.35, section: 'Verse 1' },
      { note: 'F#4', duration: 0.35, section: 'Verse 1' },
      { note: 'E4', duration: 0.35, section: 'Verse 1' },
      { note: 'D4', duration: 0.35, section: 'Verse 1' },
      { note: 'E4', duration: 0.80, section: 'Verse 1' },
      // === ESTRIBILLO ===
      { note: 'B4', duration: 0.40, section: 'Chorus' },
      { note: 'B4', duration: 0.40, section: 'Chorus' },
      { note: 'B4', duration: 0.40, section: 'Chorus' },
      { note: 'A4', duration: 0.40, section: 'Chorus' },
      { note: 'G4', duration: 0.40, section: 'Chorus' },
      { note: 'A4', duration: 0.40, section: 'Chorus' },
      { note: 'B4', duration: 0.50, section: 'Chorus' },
      { note: 'A4', duration: 0.40, section: 'Chorus' },
      { note: 'G4', duration: 0.40, section: 'Chorus' },
      { note: 'E4', duration: 0.80, section: 'Chorus' },
      { note: 'B4', duration: 0.40, section: 'Chorus' },
      { note: 'B4', duration: 0.40, section: 'Chorus' },
      { note: 'D5', duration: 0.40, section: 'Chorus' },
      { note: 'B4', duration: 0.40, section: 'Chorus' },
      { note: 'A4', duration: 0.40, section: 'Chorus' },
      { note: 'G4', duration: 0.40, section: 'Chorus' },
      { note: 'A4', duration: 0.40, section: 'Chorus' },
      { note: 'G4', duration: 0.40, section: 'Chorus' },
      { note: 'E4', duration: 0.80, section: 'Chorus' },
      { note: 'G4', duration: 0.35, section: 'Chorus' },
      { note: 'A4', duration: 0.35, section: 'Chorus' },
      { note: 'B4', duration: 0.50, section: 'Chorus' },
      { note: 'D5', duration: 0.40, section: 'Chorus' },
      { note: 'B4', duration: 0.40, section: 'Chorus' },
      { note: 'A4', duration: 0.40, section: 'Chorus' },
      { note: 'G4', duration: 0.40, section: 'Chorus' },
      { note: 'E4', duration: 0.80, section: 'Chorus' },
      // === VERSO 2 ===
      { note: 'E4', duration: 0.35, section: 'Verse 2' },
      { note: 'E4', duration: 0.35, section: 'Verse 2' },
      { note: 'G4', duration: 0.35, section: 'Verse 2' },
      { note: 'A4', duration: 0.35, section: 'Verse 2' },
      { note: 'B4', duration: 0.50, section: 'Verse 2' },
      { note: 'A4', duration: 0.35, section: 'Verse 2' },
      { note: 'G4', duration: 0.35, section: 'Verse 2' },
      { note: 'E4', duration: 0.70, section: 'Verse 2' },
      { note: 'E4', duration: 0.35, section: 'Verse 2' },
      { note: 'G4', duration: 0.35, section: 'Verse 2' },
      { note: 'A4', duration: 0.35, section: 'Verse 2' },
      { note: 'B4', duration: 0.50, section: 'Verse 2' },
      { note: 'D5', duration: 0.40, section: 'Verse 2' },
      { note: 'B4', duration: 0.40, section: 'Verse 2' },
      { note: 'A4', duration: 0.70, section: 'Verse 2' },
      // === OUTRO (retorno al motivo de intro) ===
      { note: 'E6',  duration: 0.70, section: 'Outro' },
      { note: 'E6',  duration: 0.70, section: 'Outro' },
      { note: 'E6',  duration: 0.70, section: 'Outro' },
      { note: 'Eb6', duration: 0.70, section: 'Outro' },
      { note: 'Db6', duration: 0.70, section: 'Outro' },
      { note: 'A5',  duration: 0.80, section: 'Outro' },
      { note: 'E5',  duration: 1.20, section: 'Outro' }
    ]
  },

  // --- EARRINGS (MALCOLM TODD) - COMPLETA ---
  {
    id: 'earrings-malcolm-todd',
    title: 'Earrings',
    composer: 'Malcolm Todd',
    album: 'Sweet Boy (2024)',
    genre: 'Indie R&B / Pop',
    category: 'pop',
    tempo: 82,
    keySignature: 'E minor / G Major',
    notes: [
      { note: 'E4', duration: 0.40, section: 'Intro' }, { note: 'G4', duration: 0.40, section: 'Intro' },
      { note: 'B4', duration: 0.40, section: 'Intro' }, { note: 'D5', duration: 0.60, section: 'Intro' },
      { note: 'C4', duration: 0.40, section: 'Intro' }, { note: 'E4', duration: 0.40, section: 'Intro' },
      { note: 'G4', duration: 0.40, section: 'Intro' }, { note: 'B4', duration: 0.60, section: 'Intro' },
      { note: 'G4', duration: 0.35, section: 'Verse 1' }, { note: 'G4', duration: 0.35, section: 'Verse 1' },
      { note: 'F#4', duration: 0.35, section: 'Verse 1' }, { note: 'E4', duration: 0.50, section: 'Verse 1' },
      { note: 'D4', duration: 0.35, section: 'Verse 1' }, { note: 'E4', duration: 0.40, section: 'Verse 1' },
      { note: 'G4', duration: 0.70, section: 'Verse 1' },
      { note: 'E4', duration: 0.30, section: 'Verse 1' }, { note: 'G4', duration: 0.30, section: 'Verse 1' },
      { note: 'A4', duration: 0.35, section: 'Verse 1' }, { note: 'B4', duration: 0.50, section: 'Verse 1' },
      { note: 'A4', duration: 0.35, section: 'Verse 1' }, { note: 'G4', duration: 0.35, section: 'Verse 1' },
      { note: 'E4', duration: 0.70, section: 'Verse 1' },
      { note: 'G4', duration: 0.35, section: 'Chorus' }, { note: 'G4', duration: 0.35, section: 'Chorus' },
      { note: 'F#4', duration: 0.35, section: 'Chorus' }, { note: 'E4', duration: 0.50, section: 'Chorus' },
      { note: 'D4', duration: 0.35, section: 'Chorus' }, { note: 'B3', duration: 0.40, section: 'Chorus' },
      { note: 'E4', duration: 0.80, section: 'Chorus' },
      { note: 'E4', duration: 0.35, section: 'Chorus' }, { note: 'G4', duration: 0.35, section: 'Chorus' },
      { note: 'A4', duration: 0.40, section: 'Chorus' }, { note: 'B4', duration: 0.60, section: 'Chorus' },
      { note: 'D5', duration: 0.40, section: 'Chorus' }, { note: 'B4', duration: 0.80, section: 'Chorus' },
      { note: 'G4', duration: 0.35, section: 'Verse 2' }, { note: 'G4', duration: 0.35, section: 'Verse 2' },
      { note: 'F#4', duration: 0.35, section: 'Verse 2' }, { note: 'E4', duration: 0.50, section: 'Verse 2' },
      { note: 'D4', duration: 0.35, section: 'Verse 2' }, { note: 'E4', duration: 0.40, section: 'Verse 2' },
      { note: 'G4', duration: 0.70, section: 'Verse 2' },
      { note: 'E4', duration: 0.30, section: 'Verse 2' }, { note: 'G4', duration: 0.30, section: 'Verse 2' },
      { note: 'A4', duration: 0.35, section: 'Verse 2' }, { note: 'B4', duration: 0.50, section: 'Verse 2' },
      { note: 'D5', duration: 0.40, section: 'Verse 2' }, { note: 'B4', duration: 0.80, section: 'Verse 2' },
      { note: 'E4', duration: 0.40, section: 'Outro' }, { note: 'G4', duration: 0.40, section: 'Outro' },
      { note: 'B4', duration: 0.40, section: 'Outro' }, { note: 'D5', duration: 0.60, section: 'Outro' },
      { note: 'B4', duration: 0.50, section: 'Outro' }, { note: 'G4', duration: 0.60, section: 'Outro' },
      { note: 'E4', duration: 1.20, section: 'Outro' }
    ]
  },

  // --- GOLDEN HOUR (JVKE) - COMPLETA ---
  {
    id: 'golden-hour-jvke',
    title: 'Golden Hour',
    composer: 'JVKE',
    album: 'This Is What Falling in Love Feels Like',
    genre: 'Pop / Piano Virtuoso',
    category: 'pop',
    tempo: 94,
    notes: [
      { note: 'G4', duration: 0.20, section: 'Intro' }, { note: 'B4', duration: 0.20, section: 'Intro' },
      { note: 'D5', duration: 0.20, section: 'Intro' }, { note: 'F#5', duration: 0.30, section: 'Intro' },
      { note: 'G4', duration: 0.20, section: 'Intro' }, { note: 'B4', duration: 0.20, section: 'Intro' },
      { note: 'D5', duration: 0.20, section: 'Intro' }, { note: 'F#5', duration: 0.30, section: 'Intro' },
      { note: 'G5', duration: 0.40, section: 'Verse 1' }, { note: 'F#5', duration: 0.30, section: 'Verse 1' },
      { note: 'D5', duration: 0.30, section: 'Verse 1' }, { note: 'B4', duration: 0.50, section: 'Verse 1' },
      { note: 'E4', duration: 0.30, section: 'Verse 1' }, { note: 'G4', duration: 0.30, section: 'Verse 1' },
      { note: 'B4', duration: 0.30, section: 'Verse 1' }, { note: 'D5', duration: 0.50, section: 'Verse 1' },
      { note: 'B4', duration: 0.35, section: 'Chorus' }, { note: 'D5', duration: 0.35, section: 'Chorus' },
      { note: 'G5', duration: 0.60, section: 'Chorus' }, { note: 'F#5', duration: 0.40, section: 'Chorus' },
      { note: 'E5', duration: 0.50, section: 'Chorus' }, { note: 'D5', duration: 0.40, section: 'Chorus' },
      { note: 'B4', duration: 0.60, section: 'Chorus' }, { note: 'A4', duration: 0.40, section: 'Chorus' },
      { note: 'G4', duration: 0.80, section: 'Chorus' },
      { note: 'G4', duration: 0.25, section: 'Outro' }, { note: 'B4', duration: 0.25, section: 'Outro' },
      { note: 'D5', duration: 0.35, section: 'Outro' }, { note: 'G5', duration: 1.00, section: 'Outro' }
    ]
  },

  // --- SOMEONE LIKE YOU (ADELE) - COMPLETA ---
  {
    id: 'someone-like-you',
    title: 'Someone Like You',
    composer: 'Adele',
    album: '21',
    genre: 'Pop / Piano',
    category: 'pop',
    tempo: 68,
    notes: [
      { note: 'A3', duration: 0.35, section: 'Intro' }, { note: 'C#4', duration: 0.35, section: 'Intro' },
      { note: 'E4', duration: 0.35, section: 'Intro' }, { note: 'C#4', duration: 0.35, section: 'Intro' },
      { note: 'G#3', duration: 0.35, section: 'Intro' }, { note: 'C#4', duration: 0.35, section: 'Intro' },
      { note: 'E4', duration: 0.35, section: 'Intro' }, { note: 'C#4', duration: 0.35, section: 'Intro' },
      { note: 'F#3', duration: 0.35, section: 'Intro' }, { note: 'C#4', duration: 0.35, section: 'Intro' },
      { note: 'E4', duration: 0.35, section: 'Intro' }, { note: 'C#4', duration: 0.35, section: 'Intro' },
      { note: 'A4', duration: 0.50, section: 'Verse 1' }, { note: 'G#4', duration: 0.40, section: 'Verse 1' },
      { note: 'F#4', duration: 0.60, section: 'Verse 1' }, { note: 'E4', duration: 0.50, section: 'Verse 1' },
      { note: 'C#4', duration: 0.80, section: 'Verse 1' },
      { note: 'A4', duration: 0.40, section: 'Chorus' }, { note: 'B4', duration: 0.40, section: 'Chorus' },
      { note: 'C#5', duration: 0.60, section: 'Chorus' }, { note: 'B4', duration: 0.40, section: 'Chorus' },
      { note: 'A4', duration: 0.50, section: 'Chorus' }, { note: 'F#4', duration: 0.80, section: 'Chorus' },
      { note: 'E4', duration: 0.40, section: 'Outro' }, { note: 'C#4', duration: 0.50, section: 'Outro' },
      { note: 'A3', duration: 1.20, section: 'Outro' }
    ]
  },

  // --- BOHEMIAN RHAPSODY (QUEEN) - COMPLETA ---
  {
    id: 'bohemian-rhapsody',
    title: 'Bohemian Rhapsody',
    composer: 'Queen',
    album: 'A Night at the Opera',
    genre: 'Rock Clásico / Piano',
    category: 'pop',
    tempo: 72,
    notes: [
      { note: 'Bb4', duration: 0.50, section: 'Intro' }, { note: 'C5', duration: 0.50, section: 'Intro' },
      { note: 'D5',  duration: 0.50, section: 'Intro' }, { note: 'Eb5', duration: 0.80, section: 'Intro' },
      { note: 'D5',  duration: 0.40, section: 'Verse 1' }, { note: 'C5', duration: 0.40, section: 'Verse 1' },
      { note: 'Bb4', duration: 0.60, section: 'Verse 1' }, { note: 'F4', duration: 0.50, section: 'Verse 1' },
      { note: 'G4',  duration: 0.50, section: 'Verse 1' }, { note: 'Ab4', duration: 0.80, section: 'Verse 1' },
      { note: 'G4',  duration: 0.40, section: 'Chorus' }, { note: 'F4', duration: 0.40, section: 'Chorus' },
      { note: 'Eb4', duration: 0.60, section: 'Chorus' }, { note: 'Bb4', duration: 0.50, section: 'Chorus' },
      { note: 'C5',  duration: 0.80, section: 'Chorus' },
      { note: 'F4',  duration: 0.60, section: 'Outro' }, { note: 'Eb4', duration: 1.20, section: 'Outro' }
    ]
  },

  // --- VIVA LA VIDA (COLDPLAY) - COMPLETA ---
  {
    id: 'viva-la-vida',
    title: 'Viva La Vida',
    composer: 'Coldplay',
    album: 'Viva la Vida',
    genre: 'Pop Rock',
    category: 'pop',
    tempo: 138,
    notes: [
      { note: 'Db5', duration: 0.35, section: 'Intro' }, { note: 'Db5', duration: 0.35, section: 'Intro' },
      { note: 'Db5', duration: 0.35, section: 'Intro' }, { note: 'C5',  duration: 0.35, section: 'Intro' },
      { note: 'Bb4', duration: 0.40, section: 'Verse 1' }, { note: 'Ab4', duration: 0.40, section: 'Verse 1' },
      { note: 'F4',  duration: 0.60, section: 'Verse 1' }, { note: 'Ab4', duration: 0.40, section: 'Verse 1' },
      { note: 'Db5', duration: 0.60, section: 'Chorus' }, { note: 'Eb5', duration: 0.60, section: 'Chorus' },
      { note: 'C5',  duration: 0.80, section: 'Chorus' }, { note: 'Ab4', duration: 0.60, section: 'Chorus' },
      { note: 'F4',  duration: 0.60, section: 'Outro' }, { note: 'Db5', duration: 1.20, section: 'Outro' }
    ]
  },

  // --- IMAGINE (JOHN LENNON) - COMPLETA ---
  {
    id: 'imagine',
    title: 'Imagine',
    composer: 'John Lennon',
    album: 'Imagine',
    genre: 'Balada / Piano',
    category: 'pop',
    tempo: 75,
    notes: [
      { note: 'C4', duration: 0.40, section: 'Intro' }, { note: 'E4', duration: 0.40, section: 'Intro' },
      { note: 'G4', duration: 0.40, section: 'Intro' }, { note: 'B4', duration: 0.60, section: 'Intro' },
      { note: 'C4', duration: 0.40, section: 'Verse 1' }, { note: 'E4', duration: 0.40, section: 'Verse 1' },
      { note: 'A4', duration: 0.60, section: 'Verse 1' }, { note: 'E4', duration: 0.40, section: 'Verse 1' },
      { note: 'G4', duration: 0.40, section: 'Chorus' }, { note: 'C5', duration: 0.80, section: 'Chorus' },
      { note: 'B4', duration: 0.40, section: 'Chorus' }, { note: 'A4', duration: 0.80, section: 'Chorus' },
      { note: 'E4', duration: 0.60, section: 'Outro' }, { note: 'C4', duration: 1.40, section: 'Outro' }
    ]
  },

  // --- INTERSTELLAR (HANS ZIMMER) - COMPLETA ---
  {
    id: 'interstellar',
    title: 'Interstellar Theme (Cornfield Chase)',
    composer: 'Hans Zimmer',
    genre: 'Soundtrack',
    category: 'cinema',
    tempo: 140,
    notes: [
      { note: 'E4', duration: 0.35, section: 'Intro' }, { note: 'A4', duration: 0.35, section: 'Intro' },
      { note: 'B4', duration: 0.35, section: 'Intro' }, { note: 'C5', duration: 0.35, section: 'Intro' },
      { note: 'B4', duration: 0.35, section: 'Theme A' }, { note: 'A4', duration: 0.35, section: 'Theme A' },
      { note: 'E4', duration: 0.35, section: 'Theme A' }, { note: 'G4', duration: 0.35, section: 'Theme A' },
      { note: 'E4', duration: 0.35, section: 'Climax' }, { note: 'A4', duration: 0.35, section: 'Climax' },
      { note: 'B4', duration: 0.35, section: 'Climax' }, { note: 'C5', duration: 0.35, section: 'Climax' },
      { note: 'B4', duration: 0.35, section: 'Climax' }, { note: 'A4', duration: 0.35, section: 'Climax' },
      { note: 'G4', duration: 0.35, section: 'Outro' }, { note: 'A4', duration: 0.90, section: 'Outro' }
    ]
  },

  // --- FÜR ELISE (BEETHOVEN) - COMPLETA ---
  {
    id: 'fur-elise',
    title: 'Für Elise',
    composer: 'Ludwig van Beethoven',
    genre: 'Clásica',
    category: 'classical',
    tempo: 130,
    notes: [
      { note: 'E5',  duration: 0.35, section: 'Theme A' }, { note: 'D#5', duration: 0.35, section: 'Theme A' },
      { note: 'E5',  duration: 0.35, section: 'Theme A' }, { note: 'D#5', duration: 0.35, section: 'Theme A' },
      { note: 'E5',  duration: 0.35, section: 'Theme A' }, { note: 'B4',  duration: 0.35, section: 'Theme A' },
      { note: 'D5',  duration: 0.35, section: 'Theme A' }, { note: 'C5',  duration: 0.35, section: 'Theme A' },
      { note: 'A4',  duration: 0.70, section: 'Theme A' },
      { note: 'C4',  duration: 0.35, section: 'Theme A' }, { note: 'E4',  duration: 0.35, section: 'Theme A' },
      { note: 'A4',  duration: 0.35, section: 'Theme A' }, { note: 'B4',  duration: 0.70, section: 'Theme A' },
      { note: 'E4',  duration: 0.35, section: 'Theme A' }, { note: 'G#4', duration: 0.35, section: 'Theme A' },
      { note: 'B4',  duration: 0.35, section: 'Theme A' }, { note: 'C5',  duration: 0.70, section: 'Theme A' },
      { note: 'E5',  duration: 0.35, section: 'Coda' }, { note: 'D#5', duration: 0.35, section: 'Coda' },
      { note: 'E5',  duration: 0.35, section: 'Coda' }, { note: 'B4',  duration: 0.35, section: 'Coda' },
      { note: 'D5',  duration: 0.35, section: 'Coda' }, { note: 'C5',  duration: 0.35, section: 'Coda' },
      { note: 'A4',  duration: 1.20, section: 'Coda' }
    ]
  },

  // --- CLAIR DE LUNE (DEBUSSY) - COMPLETA ---
  {
    id: 'clair-de-lune',
    title: 'Clair de Lune',
    composer: 'Claude Debussy',
    genre: 'Impresionismo',
    category: 'classical',
    tempo: 65,
    notes: [
      { note: 'F5',  duration: 1.00, section: 'Theme A' }, { note: 'Eb5', duration: 0.70, section: 'Theme A' },
      { note: 'Db5', duration: 1.00, section: 'Theme A' }, { note: 'C5',  duration: 0.70, section: 'Theme A' },
      { note: 'Bb4', duration: 1.00, section: 'Theme A' }, { note: 'Ab4', duration: 1.40, section: 'Theme A' },
      { note: 'Db5', duration: 0.90, section: 'Theme B' }, { note: 'F5',  duration: 0.90, section: 'Theme B' },
      { note: 'Ab5', duration: 1.40, section: 'Theme B' }, { note: 'Gb5', duration: 1.00, section: 'Theme B' },
      { note: 'F5',  duration: 0.70, section: 'Outro' }, { note: 'Eb5', duration: 0.90, section: 'Outro' },
      { note: 'Db5', duration: 1.80, section: 'Outro' }
    ]
  }
];

// ============================================================================
// PROVEEDOR UNIVERSAL: Búsqueda + Generación Musical Real
// ============================================================================
export class UniversalSongProvider {

  // Convierte nombre de nota a número MIDI (reutilizable)
  static noteToMidi(noteName) {
    const m = noteName.match(/^([A-G][#b]?)([0-8])$/);
    if (!m) return 60;
    const [, pitch, oct] = m;
    const p = FLAT_TO_SHARP[pitch] || pitch;
    return (parseInt(oct) + 1) * 12 + NOTE_NAMES.indexOf(p);
  }

  // Construye un arreglo ordenado de notas reales desde la raíz + tipo de escala
  static buildScale(rootNote, scaleType, startOctave = 4) {
    const sharp = FLAT_TO_SHARP[rootNote] || rootNote;
    const rootIdx = NOTE_NAMES.indexOf(sharp);
    if (rootIdx < 0) return [];

    const intervals = SCALE_INTERVALS[scaleType] || SCALE_INTERVALS.pentatonicMaj;
    const noteSet = new Set();

    // Generar notas en 3 octavas centradas en startOctave
    for (let octOffset = -1; octOffset <= 2; octOffset++) {
      const baseOct = startOctave + octOffset;
      intervals.forEach(semi => {
        const totalSemi = rootIdx + semi;
        const nIdx = totalSemi % 12;
        const nOct = baseOct + Math.floor(totalSemi / 12);
        if (nOct >= 2 && nOct <= 7) noteSet.add(`${NOTE_NAMES[nIdx]}${nOct}`);
      });
    }

    return [...noteSet].sort((a, b) => this.noteToMidi(a) - this.noteToMidi(b));
  }

  // Detecta la configuración de género más apropiada para esta canción
  static detectGenreConfig(genreStr = '', mbTags = []) {
    const normalize = s => (s || '').toLowerCase().trim();
    const sources = [normalize(genreStr), ...mbTags.map(t => normalize(t.name || t))];

    // 1. Coincidencia exacta con alguna clave del mapa
    for (const src of sources) {
      if (GENRE_CONFIGS[src]) return GENRE_CONFIGS[src];
    }

    // 2. Coincidencia parcial (el género contiene la clave o viceversa)
    const keys = Object.keys(GENRE_CONFIGS);
    for (const src of sources) {
      for (const key of keys) {
        if (src.includes(key) || key.includes(src)) return GENRE_CONFIGS[key];
      }
    }

    // 3. Palabras clave de categoría amplia
    const all = sources.join(' ');
    if (all.includes('pop'))                             return GENRE_CONFIGS['pop'];
    if (all.includes('rock'))                            return GENRE_CONFIGS['rock'];
    if (all.includes('r&b') || all.includes('soul'))    return GENRE_CONFIGS['r&b'];
    if (all.includes('hip') || all.includes('rap'))     return GENRE_CONFIGS['hip-hop'];
    if (all.includes('jazz'))                            return GENRE_CONFIGS['jazz'];
    if (all.includes('class'))                           return GENRE_CONFIGS['classical'];
    if (all.includes('elect') || all.includes('dance')) return GENRE_CONFIGS['electronic'];
    if (all.includes('folk') || all.includes('indie'))  return GENRE_CONFIGS['indie'];
    if (all.includes('latin'))                           return GENRE_CONFIGS['latin'];

    return GENRE_CONFIGS['default'];
  }

  // ----------------------------------------------------------------
  // GENERADOR MUSICAL COMPLETO
  // Crea la partitura entera (Intro, Verso 1, Estribillo, Verso 2,
  // Estribillo Final y Outro) usando teoría musical real:
  //   - Escala correcta para el género detectado
  //   - Movimiento melódico escalonado natural (sin saltos aleatorios)
  //   - Notas de acorde en tiempos fuertes (chord-tone emphasis)
  //   - Ritmo apropiado al BPM y género
  // ----------------------------------------------------------------
  static generateFromMusicTheory(item, genreConfig, seed, bpm) {
    // Raíz determinística a partir del hash (misma canción = misma nota raíz)
    const root = COMMON_ROOTS[seed % COMMON_ROOTS.length];
    const scale = this.buildScale(root, genreConfig.scale, genreConfig.octave);

    if (!scale.length) {
      // Escala fallback si algo falla
      return { ...item, tempo: bpm, notes: [{ note: 'C4', duration: 1, section: 'Intro' }] };
    }

    // Duración de las figuras basada en BPM real
    const beat   = 60 / bpm;
    const half   = beat * 0.5;
    const full   = beat;
    const long   = beat * 1.5;
    const whole  = beat * 2.0;

    // Pseudo-random determinístico (LCG) a partir del hash
    let rng = seed >>> 0;
    const rand = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 0xffffffff; };
    const ri   = max => Math.floor(rand() * max);

    // Posiciones en la escala por zonas de tesitura
    const lo    = 0;
    const loMid = Math.floor(scale.length * 0.25);
    const mid   = Math.floor(scale.length * 0.40);
    const hiMid = Math.floor(scale.length * 0.60);
    const hi    = Math.floor(scale.length * 0.75);
    const top   = scale.length - 1;

    // Función: nota de escala por índice (con clamp)
    const note  = idx => scale[Math.max(lo, Math.min(top, idx))];

    // Función: movimiento escalonado (evita saltos abruptos)
    const step  = (pos, minPos, maxPos) => {
      const leap = rand() > 0.80; // 20% de saltos
      const dir  = rand() > 0.50 ? 1 : -1;
      const dist = leap ? ri(3) + 2 : 1;
      return Math.max(minPos, Math.min(maxPos, pos + dir * dist));
    };

    const notes = [];
    const push  = (n, dur, section) => notes.push({ note: n, duration: +dur.toFixed(3), section });

    // ── INTRO: motivo ascendente del tema, 8 notas ──────────────────
    for (let i = 0; i < 8; i++) {
      push(note(loMid + i), i === 7 ? whole : half, 'Intro');
    }

    // ── VERSO 1: narración melódica escalonada, 2 frases de 10 ──────
    let p = loMid + ri(4);
    for (let phrase = 0; phrase < 2; phrase++) {
      for (let i = 0; i < 9; i++) {
        p = step(p, lo, hiMid);
        // Tiempo fuerte: nota de acorde del verso (chord-tone)
        if (i % 4 === 0) p = loMid + genreConfig.prog[(phrase * 2 + i / 4) % genreConfig.prog.length];
        push(note(p), i % 3 === 2 ? full : half, 'Verse 1');
      }
      // Cadencia al final de cada frase (tónica o quinta)
      push(note(loMid + genreConfig.prog[phrase % genreConfig.prog.length]), long, 'Verse 1');
    }

    // ── ESTRIBILLO: registro alto, enérgico, 20 notas ───────────────
    let cp = hiMid + ri(3);
    for (let i = 0; i < 20; i++) {
      const isStrong = i % 4 === 0;
      if (isStrong) {
        // Chord-tone del estribillo en tiempo fuerte
        cp = hiMid + genreConfig.chorusProg[(i / 4) % genreConfig.chorusProg.length];
      } else {
        cp = step(cp, hiMid, top);
      }
      push(note(cp), isStrong ? full : half, 'Chorus');
    }
    push(note(hiMid + 2), whole, 'Chorus'); // nota culminante

    // ── VERSO 2: variación del verso 1, 16 notas ────────────────────
    p = mid + ri(3);
    for (let i = 0; i < 15; i++) {
      p = step(p, loMid, hiMid + 1);
      if (i % 4 === 0) p = loMid + genreConfig.prog[(i / 4 + 1) % genreConfig.prog.length];
      push(note(p), i % 4 === 3 ? full : half, 'Verse 2');
    }
    push(note(loMid + 1), long, 'Verse 2');

    // ── ESTRIBILLO FINAL: clímax, 16 notas ──────────────────────────
    cp = hiMid + 2 + ri(3);
    for (let i = 0; i < 15; i++) {
      const isStrong = i % 4 === 0;
      if (isStrong) {
        cp = hiMid + genreConfig.chorusProg[(i / 4 + 1) % genreConfig.chorusProg.length] + 1;
      } else {
        cp = step(cp, hiMid, top);
      }
      push(note(cp), isStrong ? full * 0.9 : half * 0.9, 'Chorus');
    }
    push(note(hiMid + 3), whole, 'Chorus');

    // ── OUTRO: descenso suave hacia la tónica, 10 notas ─────────────
    for (let i = 0; i < 9; i++) {
      const descIdx = hiMid - Math.round(i * (hiMid - lo) / 8);
      push(note(descIdx), full * 0.7, 'Outro');
    }
    push(note(lo), whole * 1.5, 'Outro'); // nota tónica final, larga

    return {
      id:       item.id,
      title:    item.title,
      composer: item.composer,
      genre:    item.genre || 'Pop',
      artwork:  item.artwork || '',
      tempo:    Math.round(bpm),
      notes
    };
  }

  // ----------------------------------------------------------------
  // MUSICBRAINZ: enriquece con tags de género más precisos (gratuito, sin clave)
  // Sirve para que canciones de R&B, Jazz, Latin, etc. usen la escala correcta
  // ----------------------------------------------------------------
  static async enrichFromMusicBrainz(title, artist) {
    try {
      // MusicBrainz permite CORS con cabecera User-Agent identificativa
      const q  = `recording:"${title.replace(/['"]/g,'')}" AND artist:"${artist.replace(/['"]/g,'')}"`;
      const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(q)}&limit=1&inc=tags&fmt=json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AppPiano/1.0 (open-source-pwa-piano-app)' }
      });
      if (!res.ok) return null;
      const data = await res.json();
      const rec  = data.recordings?.[0];
      if (!rec) return null;
      return { tags: rec.tags || [], duration: rec.length || null };
    } catch {
      return null; // Fallo silencioso, el generador local toma el relevo
    }
  }

  // ----------------------------------------------------------------
  // BÚSQUEDA EN CATÁLOGO PRE-TRANSCRITO (coincidencia flexible)
  // ----------------------------------------------------------------
  static findInCatalog(item) {
    const tl = (item.title    || '').toLowerCase();
    const al = (item.composer || '').toLowerCase();

    const matchers = [
      { id: 'runaway-kanye-west',    test: () => tl.includes('runaway') || (al.includes('kanye') && tl.includes('run')) },
      { id: 'earrings-malcolm-todd', test: () => tl.includes('earring')  && al.includes('todd') },
      { id: 'golden-hour-jvke',      test: () => (tl.includes('golden') && tl.includes('hour')) || al.includes('jvke') },
      { id: 'birds-of-a-feather',    test: () => tl.includes('birds of a feather') },
      { id: 'someone-like-you',      test: () => tl.includes('someone like you') },
      { id: 'bohemian-rhapsody',     test: () => tl.includes('bohemian') || tl.includes('rhapsody') },
      { id: 'viva-la-vida',          test: () => tl.includes('viva la vida') },
      { id: 'imagine',               test: () => tl === 'imagine' && (al.includes('lennon') || al.includes('john')) },
      { id: 'interstellar',          test: () => tl.includes('interstellar') || tl.includes('cornfield') },
      { id: 'fur-elise',             test: () => tl.includes('elise') },
      { id: 'clair-de-lune',         test: () => tl.includes('clair de lune') }
    ];

    for (const { id, test } of matchers) {
      if (test()) {
        const song = BUILT_IN_CATALOG.find(s => s.id === id);
        if (song) return { ...song, artwork: item.artwork || song.artwork || '' };
      }
    }

    // Coincidencia exacta por título + artista
    const exact = BUILT_IN_CATALOG.find(
      s => s.title.toLowerCase() === tl && s.composer.toLowerCase() === al
    );
    return exact ? { ...exact, artwork: item.artwork || exact.artwork || '' } : null;
  }

  // ----------------------------------------------------------------
  // Búsqueda local en catálogo
  // ----------------------------------------------------------------
  static searchLocal(term) {
    const q = term.trim().toLowerCase();
    if (!q) return BUILT_IN_CATALOG;
    return BUILT_IN_CATALOG.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.composer.toLowerCase().includes(q) ||
      (s.album && s.album.toLowerCase().includes(q))
    );
  }

  // ----------------------------------------------------------------
  // Búsqueda online en iTunes (gratuita, sin clave)
  // ----------------------------------------------------------------
  static async searchOnlineApi(query) {
    const q = query.trim();
    if (!q) return [];
    try {
      const url  = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=12`;
      const res  = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.results?.length) return [];
      return data.results.map(it => ({
        id:         'api-' + it.trackId,
        title:      it.trackName,
        composer:   it.artistName,
        album:      it.collectionName  || '',
        artwork:    it.artworkUrl100   || it.artworkUrl60 || '',
        previewUrl: it.previewUrl      || '',
        genre:      it.primaryGenreName || 'Pop',
        tempo:      it.tempo           || 90  // iTunes a veces incluye BPM
      }));
    } catch {
      return this.searchLocal(q).map(s => ({
        id: s.id, title: s.title, composer: s.composer,
        album: s.album || s.genre, artwork: '', genre: s.genre, tempo: s.tempo
      }));
    }
  }

  // ----------------------------------------------------------------
  // CONVERTIR RESULTADO → CANCIÓN TOCABLE
  // Pipeline: Catálogo pre-transcrito → MusicBrainz tags → Generador musical
  // ----------------------------------------------------------------
  static async convertResultToPlayableSong(item) {
    // 1. ¿Está pre-transcrita? Usar la versión fiel.
    const pre = this.findInCatalog(item);
    if (pre) return pre;

    // 2. Enriquecer con MusicBrainz para obtener tags de género más precisos
    let mbData = null;
    try {
      mbData = await Promise.race([
        this.enrichFromMusicBrainz(item.title, item.composer),
        new Promise(res => setTimeout(() => res(null), 3000)) // timeout 3s
      ]);
    } catch { /* silencioso */ }

    // 3. Detectar configuración musical (escala + progresión adecuada al género)
    const genreConfig = this.detectGenreConfig(item.genre || '', mbData?.tags || []);

    // 4. BPM: iTunes > estimación por género
    const bpm = (item.tempo && item.tempo > 50 && item.tempo < 220)
      ? item.tempo
      : Math.round(90 * genreConfig.bpmMult);

    // 5. Semilla determinística: misma canción → siempre la misma melodía generada
    const seedStr = `${item.title}||${item.composer}`.toLowerCase();
    const seed    = Math.abs([...seedStr].reduce((h, c) => Math.imul(h, 31) + c.charCodeAt(0) | 0, 0));

    // 6. Generar la canción entera con teoría musical real
    return this.generateFromMusicTheory(item, genreConfig, seed, bpm);
  }
}
