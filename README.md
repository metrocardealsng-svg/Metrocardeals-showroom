# MetroCarDeals Showroom

A static, mobile-first Abuja car showroom with GSAP scroll animation, six vehicle listings, 18 actual car photographs, filtering, saved cars and direct WhatsApp enquiries.

## Deploy to Vercel
Import this repository in Vercel. Framework: **Other**. Build command: **empty**. Output directory: **public**. The included vercel.json configures these settings. No dependencies or environment variables are required.

## Make changes
- Cars, prices and photo galleries: public/app.js
- Page copy and contact details: public/index.html
- Styling: public/styles.css
- Photos: public/assets/cars/

After connecting the repository in Vercel, pushes to main can deploy automatically.

Address: Jereton Samuel Jackson Street, Apo Legislative Quarters, Zone B, Abuja.
WhatsApp: 09030914429 and 09073965030.

Inventory is manually maintained; automatic Instagram syncing is not enabled. The red Camry awaits year, condition and price confirmation.

## Local preview
Run `python3 -m http.server 8000 --directory public`.

The scripts directory contains a one-time media import with SHA-256 verification. Once assets are committed, the website works independently of its original host.
