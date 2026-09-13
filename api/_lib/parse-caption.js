const KNOWN_MAKES = [
  'Toyota', 'Hyundai', 'Infiniti', 'Xiaomi', 'Honda', 'Lexus', 'Mercedes-Benz', 'Mercedes',
  'BMW', 'Kia', 'Nissan', 'Ford', 'Peugeot', 'Mazda', 'Volkswagen', 'Land Rover', 'Range Rover',
  'Acura', 'Chevrolet', 'Audi', 'Volvo', 'Mitsubishi', 'Subaru', 'Jeep', 'Suzuki', 'Porsche',
];

const SUV_MODEL_HINTS = ['suv', 'rav4', 'santa fe', 'qx', 'x-trail', 'highlander', 'pilot', 'tucson',
  'sportage', 'creta', 'edge', 'explorer', 'range rover', 'land cruiser', 'prado', 'cr-v', 'crv',
  'pathfinder', 'murano', 'rogue', '4runner', 'sequoia', 'tahoe', 'yukon'];

const COLOR_WORDS = ['black', 'white', 'red', 'blue', 'silver', 'grey', 'gray', 'gold', 'green',
  'brown', 'maroon', 'orange', 'yellow', 'beige', 'wine', 'navy'];

function guessMakeModel(caption) {
  for (const make of KNOWN_MAKES) {
    const re = new RegExp(`\\b${make.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s+([A-Za-z0-9][A-Za-z0-9\\- ]{0,20})`, 'i');
    const match = caption.match(re);
    if (match) {
      let model = match[1].split(/[,.\n]| for | is | with | at /i)[0].trim();
      model = model.replace(/\s+(19[8-9]\d|20[0-4]\d)\b.*$/, '').replace(/\s+(₦|N\d|\d+\s?(million|m)\b).*$/i, '').trim();
      return { make, model: model || 'Confirm model' };
    }
    if (new RegExp(`\\b${make}\\b`, 'i').test(caption)) {
      return { make, model: 'Confirm model' };
    }
  }
  return { make: 'Confirm make', model: 'Confirm model' };
}

function guessYear(caption) {
  const matches = caption.match(/\b(19[8-9]\d|20[0-4]\d)\b/g);
  return matches ? Number(matches[matches.length - 1]) : null;
}

function guessPrice(caption) {
  let match = caption.match(/₦\s?([\d,.]+)\s?(million|m)?\b/i);
  if (!match) match = caption.match(/\bN\s?([\d,.]+)\s?(million|m)?\b/i);
  if (!match) return null;
  let n = parseFloat(match[1].replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  if (match[2]) n *= 1000000;
  return Math.round(n);
}

function guessCondition(caption) {
  const c = caption.toLowerCase();
  if (c.includes('brand new')) return 'Brand new';
  if (c.includes('foreign used') || c.includes('direct ')) return 'Foreign used';
  if (c.includes('nigerian used') || c.includes('naija used') || c.includes('nigeria used')) return 'Nigerian used';
  return 'Confirm condition';
}

function guessColor(caption) {
  const c = caption.toLowerCase();
  for (const color of COLOR_WORDS) {
    if (new RegExp(`\\b${color}\\b`).test(c)) return color[0].toUpperCase() + color.slice(1);
  }
  return 'Colour to confirm';
}

function guessType(model, caption) {
  const text = `${model} ${caption}`.toLowerCase();
  return SUV_MODEL_HINTS.some(hint => text.includes(hint)) ? 'SUV' : 'Sedan';
}

function parseCaption(caption = '') {
  const { make, model } = guessMakeModel(caption);
  const year = guessYear(caption);
  const price = guessPrice(caption);
  const condition = guessCondition(caption);
  const color = guessColor(caption);
  const type = guessType(model, caption);
  return {
    make,
    model,
    year,
    price: price || 0,
    type,
    condition,
    color,
    paint: '#83938c',
    tag: 'NEW LISTING',
    note: `Imported from Instagram. Original caption: "${caption.slice(0, 300)}${caption.length > 300 ? '…' : ''}" — confirm all details before publishing.`,
  };
}

module.exports = { parseCaption };
