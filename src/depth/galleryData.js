import boy3 from '@/assets/gallery/boy3.webp';
import boy4 from '@/assets/gallery/boy4.webp';
import boy5 from '@/assets/gallery/boy5.webp';
import boy6 from '@/assets/gallery/boy6.webp';
import boy8 from '@/assets/gallery/boy8.webp';
import girl3 from '@/assets/gallery/girl3.webp';
import girl6 from '@/assets/gallery/girl6.webp';
import girl9 from '@/assets/gallery/girl9.webp';
import duo1 from '@/assets/gallery/duo1.webp';
import duo2 from '@/assets/gallery/duo2.webp';
import duo3 from '@/assets/gallery/duo3.webp';
import duo4 from '@/assets/gallery/duo4.webp';
import duo5 from '@/assets/gallery/duo5.webp';

const imageSets = {
  boy: [boy3, boy4, boy5, boy6, boy8],
  girl: [girl3, girl6, girl9],
  duo: [duo1, duo2, duo3, duo4, duo5],
};

// The look stack the reader scrolls through, matching the exact data provided.
// Girl 1 was a non-transparent reference image and has been removed per instructions.
const LOOKS = [
  // --- DUOS (1 to 5) ---
  {
    id: 'duo1',
    hero: 'Duo 1',
    title: 'Quiet luxury / classic autumn tailoring',
    subtitle: 'Boy: long camel trench coat, cream polo, wide pleated brown trousers and dark leather shoes. Girl: ivory coat over a fitted cream dress with a slit, tall brown boots and a structured brown handbag.',
    palette: 'Camel, ivory, cream, chocolate brown',
    paletteColors: [
      { name: 'Camel', hex: '#C19A6B' },
      { name: 'Ivory', hex: '#FFFFF0' },
      { name: 'Cream', hex: '#FFFDD0' },
      { name: 'Chocolate brown', hex: '#4A2E18' },
    ],
    image: duo1,
    accent: '#C19A6B',
  },
  {
    id: 'duo2',
    hero: 'Duo 2',
    title: 'Y2K pop streetwear',
    subtitle: 'Boy: lavender-and-white sporty panelled T-shirt, baggy dark jeans, trainers, sunglasses and chain accessories. Girl: pink graphic crop top, washed grey denim mini skirt, studded belt, white leg warmers, pink trainers and a metallic shoulder bag.',
    palette: 'Lavender, bubblegum pink, indigo, washed grey, white, silver',
    paletteColors: [
      { name: 'Lavender', hex: '#C8A2C8' },
      { name: 'Bubblegum pink', hex: '#FF85CB' },
      { name: 'Indigo', hex: '#3F51B5' },
      { name: 'Washed grey', hex: '#8A8D91' },
      { name: 'White', hex: '#FFFFFF' },
      { name: 'Silver', hex: '#C0C0C0' },
    ],
    image: duo2,
    accent: '#FF85CB',
  },
  {
    id: 'duo3',
    hero: 'Duo 3',
    title: 'Romantic gothic / vampire-inspired formalwear',
    subtitle: 'Boy: long black velvet-look coat, burgundy shirt, tailored black trousers and polished shoes. Girl: black corset gown with sheer lace sleeves, layered ruffles, a high slit and platform lace-up boots.',
    palette: 'Black, wine red, silver accents',
    paletteColors: [
      { name: 'Black', hex: '#1A1A1A' },
      { name: 'Wine red', hex: '#8B1C2A' },
      { name: 'Silver accents', hex: '#C0C0C0' },
    ],
    image: duo3,
    accent: '#C0394A',
  },
  {
    id: 'duo4',
    hero: 'Duo 4',
    title: 'Skater-inspired denim streetwear',
    subtitle: 'Boy: oversized blue graphic sweatshirt over a white tee, very baggy light-wash jeans, navy beanie and orange-and-white trainers. Girl: white graphic crop tee, dark denim maxi skirt with a high slit, orange shoulder bag and matching trainers.',
    palette: 'Cobalt blue, light and dark denim, white, bright orange',
    paletteColors: [
      { name: 'Cobalt blue', hex: '#2979FF' },
      { name: 'Light denim', hex: '#8DA4C4' },
      { name: 'Dark denim', hex: '#2C3E50' },
      { name: 'White', hex: '#FFFFFF' },
      { name: 'Bright orange', hex: '#FF5F1F' },
    ],
    image: duo4,
    accent: '#FF5F1F',
  },
  {
    id: 'duo5',
    hero: 'Duo 5',
    title: 'Statement eveningwear / red-carpet glamour',
    subtitle: 'Boy: strong-shouldered burgundy suit with wide trousers, black shirt and black shoes. Girl: sculptural red one-shoulder mini dress with an oversized bow, asymmetric ruffles, a trailing panel and pointed ankle-strap heels.',
    palette: 'Burgundy, crimson red, black',
    paletteColors: [
      { name: 'Burgundy', hex: '#800020' },
      { name: 'Crimson red', hex: '#DC143C' },
      { name: 'Black', hex: '#111111' },
    ],
    image: duo5,
    accent: '#DC143C',
  },

  // --- GIRLS (Girl 1 removed; Girl 2, 3, 4 with transparent images) ---
  {
    id: 'girl2',
    hero: 'Girl 2',
    title: 'Utility streetwear / sporty grunge',
    subtitle: 'Oversized cream-and-burgundy jacket worn off the shoulders, burgundy sleeveless high-neck crop top, wide black cargo trousers with burgundy straps, chunky trainers, a square-buckle belt and silver jewellery.',
    palette: 'Burgundy, black, cream, silver',
    paletteColors: [
      { name: 'Burgundy', hex: '#800020' },
      { name: 'Black', hex: '#111111' },
      { name: 'Cream', hex: '#FFFDD0' },
      { name: 'Silver', hex: '#C0C0C0' },
    ],
    image: girl3,
    accent: '#9E2A2B',
  },
  {
    id: 'girl3',
    hero: 'Girl 3',
    title: 'Avant-garde occasionwear / sculptural tailoring',
    subtitle: 'Sculptural burgundy top with sweeping cream-lined folds around the shoulders and waist, slim matching ankle-length trousers, pointed heels, a decorative brooch and dangling jewellery.',
    palette: 'Deep burgundy, ivory, silver accents',
    paletteColors: [
      { name: 'Deep burgundy', hex: '#5B1425' },
      { name: 'Ivory', hex: '#FFFFF0' },
      { name: 'Silver accents', hex: '#C0C0C0' },
    ],
    image: girl6,
    accent: '#800020',
  },
  {
    id: 'girl4',
    hero: 'Girl 4',
    title: 'Retro preppy / vintage casual',
    subtitle: 'Fitted yellow-and-cream striped polo tucked into a dark denim maxi skirt with an asymmetric panel and high slit; brown knee-high boots, brown belt, shoulder bag and delicate jewellery.',
    palette: 'Butter yellow, cream, indigo denim, chocolate brown',
    paletteColors: [
      { name: 'Butter yellow', hex: '#E5C158' },
      { name: 'Cream', hex: '#FFFDD0' },
      { name: 'Indigo denim', hex: '#2B3E58' },
      { name: 'Chocolate brown', hex: '#4B2D17' },
    ],
    image: girl9,
    accent: '#E5C158',
  },

  // --- BOYS (1 to 5) ---
  {
    id: 'boy1',
    hero: 'Boy 1',
    title: 'Utility streetwear / techwear-inspired',
    subtitle: 'Oversized burgundy-and-cream hooded jacket over a loose black T-shirt; baggy black cargo trousers with multiple pockets, hanging straps and buckles; chunky trainers, layered chains and a watch.',
    palette: 'Burgundy, black, cream, silver hardware',
    paletteColors: [
      { name: 'Burgundy', hex: '#800020' },
      { name: 'Black', hex: '#111111' },
      { name: 'Cream', hex: '#FFFDD0' },
      { name: 'Silver hardware', hex: '#C0C0C0' },
    ],
    image: boy3,
    accent: '#9E2A2B',
  },
  {
    id: 'boy2',
    hero: 'Boy 2',
    title: 'Biker / modern rock style',
    subtitle: 'Burgundy leather-look biker jacket with wide lapels and metal zips, plain white T-shirt, straight black trousers, wallet chain and heavy lace-up boots.',
    palette: 'Oxblood burgundy, white, black, silver',
    paletteColors: [
      { name: 'Oxblood burgundy', hex: '#660000' },
      { name: 'White', hex: '#FFFFFF' },
      { name: 'Black', hex: '#111111' },
      { name: 'Silver', hex: '#C0C0C0' },
    ],
    image: boy4,
    accent: '#8B1C2A',
  },
  {
    id: 'boy3',
    hero: 'Boy 3',
    title: 'Skater / oversized streetwear',
    subtitle: 'Oversized cobalt sweatshirt with white-and-orange graphics over a longer white tee; extremely wide light-wash jeans with diagonal panel seams, orange-accented trainers and a pendant chain.',
    palette: 'Cobalt blue, faded denim blue, white, orange',
    paletteColors: [
      { name: 'Cobalt blue', hex: '#0047AB' },
      { name: 'Faded denim blue', hex: '#738CA6' },
      { name: 'White', hex: '#FFFFFF' },
      { name: 'Orange', hex: '#FF5F1F' },
    ],
    image: boy5,
    accent: '#FF5F1F',
  },
  {
    id: 'boy4',
    hero: 'Boy 4',
    title: 'Futuristic statement tailoring / space-age glam',
    subtitle: 'Reflective silver suit with sharply extended shoulders, oversized lapels and very wide pleated trousers; charcoal shirt, black belt and shiny metallic shoes.',
    palette: 'Chrome silver, gunmetal grey, black',
    paletteColors: [
      { name: 'Chrome silver', hex: '#E0E0E0' },
      { name: 'Gunmetal grey', hex: '#536267' },
      { name: 'Black', hex: '#111111' },
    ],
    image: boy6,
    accent: '#C0C0C0',
  },
  {
    id: 'boy5',
    hero: 'Boy 5',
    title: 'Preppy / vintage collegiate sportswear',
    subtitle: 'Green-and-cream striped rugby shirt tucked into burgundy pleated Bermuda shorts; brown belt, striped cream crew socks, green-and-white trainers and a wristwatch.',
    palette: 'Forest green, cream, burgundy, brown',
    paletteColors: [
      { name: 'Forest green', hex: '#2D6A4F' },
      { name: 'Cream', hex: '#FFFDD0' },
      { name: 'Burgundy', hex: '#800020' },
      { name: 'Brown', hex: '#5C4033' },
    ],
    image: boy8,
    accent: '#2D6A4F',
  },
];

// The color ramp for the depth gallery mood blobs, based on each look's accent color
const moods = LOOKS.map((look) => ({
  backgroundColor: '#10100f',
  blob1Color: look.accent,
  blob2Color: '#2a2826',
}));

const buildGalleryDataInner = (set) => {
  const duos = LOOKS.filter((l) => l.id.startsWith('duo'));
  if (set === 'duo') return duos;
  const chars = LOOKS.filter((l) => l.id.startsWith(set));
  return [...chars, ...duos];
};

// In scrolling, ONLY the Style Name is displayed in label.word
const buildGalleryData = (set) => {
  const base = buildGalleryDataInner(set);
  return base.map((look, index) => ({
    id: look.id,
    hero: look.hero,
    title: look.title,
    details: look.subtitle,
    palette: look.palette,
    paletteColors: look.paletteColors,
    fallbackColor: '#1c1c1c',
    accentColor: look.accent,
    textureSrc: look.image,
    position: { x: index % 2 === 0 ? -0.85 : 0.9, y: 0 },
    ...moods[index % moods.length],
    label: {
      word: look.title, // "in scrolling only diply style"
      style: look.title,
      hero: look.hero,
      pms: look.palette,
      color: look.accent,
    },
  }));
};

const galleryPlaneData = buildGalleryData('duo');

export { imageSets, buildGalleryData, galleryPlaneData, LOOKS, moods };
