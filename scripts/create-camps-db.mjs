import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'camps.db');

const db = new Database(dbPath);

// Create the summer_camps table
db.exec(`
  CREATE TABLE IF NOT EXISTS summer_camps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    location TEXT,
    address TEXT,
    email TEXT,
    phone TEXT,
    description TEXT,
    programs_available TEXT,
    hours_of_operation TEXT,
    sessions TEXT,
    highlights TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert sample data
const insert = db.prepare(`
  INSERT INTO summer_camps (title, location, address, email, phone, description, programs_available, hours_of_operation, sessions, highlights)
  VALUES (@title, @location, @address, @email, @phone, @description, @programs_available, @hours_of_operation, @sessions, @highlights)
`);

const camps = [
  {
    title: 'Camp Sunshine',
    location: 'Lake Tahoe, CA',
    address: '1234 Lakeside Drive, South Lake Tahoe, CA 96150',
    email: 'info@campsunshine.com',
    phone: '(530) 555-0101',
    description: 'A traditional summer camp experience on the shores of Lake Tahoe with swimming, hiking, and outdoor adventures.',
    programs_available: 'Swimming, Hiking, Archery, Arts & Crafts, Campfire Stories, Nature Exploration',
    hours_of_operation: 'Mon-Fri 8:00 AM - 5:00 PM, Sat 9:00 AM - 3:00 PM',
    sessions: 'Session 1: Jun 15 - Jul 5, Session 2: Jul 7 - Jul 26, Session 3: Jul 28 - Aug 15',
    highlights: 'Lakefront location, certified water sports instructors, overnight camping trips',
  },
  {
    title: 'TechKids Academy',
    location: 'Austin, TX',
    address: '567 Innovation Blvd, Austin, TX 78701',
    email: 'enroll@techkidsacademy.org',
    phone: '(512) 555-0202',
    description: 'A STEM-focused summer camp where kids learn coding, robotics, and digital design in a fun environment.',
    programs_available: 'Coding (Python, Scratch), Robotics, 3D Printing, Game Design, App Development',
    hours_of_operation: 'Mon-Fri 9:00 AM - 4:00 PM',
    sessions: 'Week 1-2: Jun 10 - Jun 21, Week 3-4: Jun 24 - Jul 5, Week 5-6: Jul 8 - Jul 19',
    highlights: 'One laptop per child, end-of-session demo day, industry guest speakers',
  },
  {
    title: 'Wilderness Explorers Camp',
    location: 'Asheville, NC',
    address: '890 Mountain Trail Rd, Asheville, NC 28801',
    email: 'hello@wildernessexplorers.camp',
    phone: '(828) 555-0303',
    description: 'An adventure-based camp in the Blue Ridge Mountains focused on survival skills, ecology, and teamwork.',
    programs_available: 'Rock Climbing, Kayaking, Wilderness Survival, Bird Watching, Trail Building, Orienteering',
    hours_of_operation: 'Mon-Sat 7:30 AM - 6:00 PM',
    sessions: 'Two-week sessions running Jun 1 through Aug 10',
    highlights: 'Leave No Trace certified, 500-acre private forest, overnight backpacking expeditions',
  },
  {
    title: 'Creative Arts Summer Studio',
    location: 'Portland, OR',
    address: '222 Gallery Lane, Portland, OR 97209',
    email: 'studio@creativeartscamp.com',
    phone: '(503) 555-0404',
    description: 'A vibrant arts camp for young creatives covering painting, theater, music, and filmmaking.',
    programs_available: 'Painting & Drawing, Theater Performance, Music Production, Filmmaking, Ceramics, Creative Writing',
    hours_of_operation: 'Mon-Fri 10:00 AM - 4:00 PM',
    sessions: 'Rolling weekly enrollment from Jun 3 through Aug 23',
    highlights: 'Professional artist mentors, end-of-summer showcase, all materials included',
  },
  {
    title: 'AquaSplash Sports Camp',
    location: 'Miami, FL',
    address: '100 Ocean Park Way, Miami Beach, FL 33139',
    email: 'splash@aquasplashcamp.com',
    phone: '(305) 555-0505',
    description: 'A water sports camp on the beach teaching surfing, paddleboarding, snorkeling, and marine biology.',
    programs_available: 'Surfing, Paddleboarding, Snorkeling, Beach Volleyball, Marine Biology, Lifeguard Training',
    hours_of_operation: 'Mon-Fri 8:00 AM - 3:00 PM',
    sessions: 'Session A: Jun 1 - Jun 28, Session B: Jul 1 - Jul 26, Session C: Aug 1 - Aug 22',
    highlights: 'Beachfront facility, reef snorkeling trips, certified surf coaches, sunscreen provided',
  },
];

const insertMany = db.transaction((camps) => {
  for (const camp of camps) {
    insert.run(camp);
  }
});

insertMany(camps);

console.log(`Created camps.db at ${dbPath}`);
console.log(`Inserted ${camps.length} sample camps into summer_camps table`);

db.close();
