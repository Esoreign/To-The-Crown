/**
 * Pistes de musique de fond (servies depuis public/music).
 */
export interface Track {
  id: string;
  title: string;
  artist: string;
  src: string;
}

const ARTIST = 'Sabrina Carpenter — version bardcore';

export const TRACKS: Track[] = [
  { id: 'espresso', title: 'Espresso', artist: ARTIST, src: '/music/espresso.mp3' },
  { id: 'taste', title: 'Taste', artist: ARTIST, src: '/music/taste.mp3' },
  { id: 'bed-chem', title: 'Bed Chem', artist: ARTIST, src: '/music/bed-chem.mp3' },
  { id: 'manchild', title: 'Manchild', artist: ARTIST, src: '/music/manchild.mp3' },
  { id: 'tears', title: 'Tears', artist: ARTIST, src: '/music/tears.mp3' },
];
