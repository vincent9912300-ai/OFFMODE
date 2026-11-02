import boy3 from '@/assets/gallery/boy3.webp';
import boy4 from '@/assets/gallery/boy4.webp';
import boy5 from '@/assets/gallery/boy5.webp';
import boy6 from '@/assets/gallery/boy6.webp';
import boy8 from '@/assets/gallery/boy8.webp';
import girl1 from '@/assets/gallery/girl1.webp';
import girl2 from '@/assets/gallery/girl2.webp';
import girl3 from '@/assets/gallery/girl3.webp';
import girl4 from '@/assets/gallery/girl4.webp';
import girl5 from '@/assets/gallery/girl5.webp';
import girl6 from '@/assets/gallery/girl6.webp';
import girl7 from '@/assets/gallery/girl7.webp';
import girl8 from '@/assets/gallery/girl8.webp';
import girl9 from '@/assets/gallery/girl9.webp';
import duo1 from '@/assets/gallery/duo1.webp';
import duo2 from '@/assets/gallery/duo2.webp';
import duo3 from '@/assets/gallery/duo3.webp';
import duo4 from '@/assets/gallery/duo4.webp';
import duo5 from '@/assets/gallery/duo5.webp';

const imageSets = {
  boy: [boy3, boy4, boy5, boy6, boy8],
  girl: [girl1, girl2, girl3, girl4, girl5, girl6, girl7, girl8, girl9],
  duo: [duo1, duo2, duo3, duo4, duo5],
};

// dark OFFMODE moods — every look gets its own dim glow palette, the GLSL
// background lerps between them as the camera dives through the stack
const moods = [
  { backgroundColor: '#151513', blob1Color: '#8a7a20', blob2Color: '#2c3440' },
  { backgroundColor: '#141416', blob1Color: '#7a6a2a', blob2Color: '#34404c' },
  { backgroundColor: '#171414', blob1Color: '#8a5a30', blob2Color: '#2c3838' },
  { backgroundColor: '#131515', blob1Color: '#6a7a30', blob2Color: '#3a3444' },
  { backgroundColor: '#16161a', blob1Color: '#8a8030', blob2Color: '#303c4a' },
];

// boy/girl picks get their character looks followed by the duo shots —
// the duo set alone is the no-pick default
const buildGalleryData = (set) =>
  (set === 'duo'
    ? imageSets.duo
    : [...imageSets[set], ...imageSets.duo]
  ).map((textureSrc, index) => ({
    fallbackColor: '#1c1c1c',
    accentColor: '#ffe500',
    textureSrc,
    position: { x: index % 2 === 0 ? -0.85 : 0.9, y: 0 },
    ...moods[index % moods.length],
    label: {
      word: `look ${String(index + 1).padStart(2, '0')}`,
      pms: 'OFFMODE',
      color: '#f4f4f4',
    },
  }));

const galleryPlaneData = buildGalleryData('duo');

export { galleryPlaneData, buildGalleryData, imageSets };
