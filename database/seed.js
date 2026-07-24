const db = require('./db');
const bcrypt = require('bcryptjs');

const seedData = async () => {
  try {
    console.log('🌱 Seeding database...');

    // 1. Create a default Admin user if none exists
    const adminCheck = await db.getAsync('SELECT id FROM admin_users LIMIT 1');
    if (!adminCheck) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await db.runAsync(
        `INSERT INTO admin_users (name, email, phone, password, profileImage) 
         VALUES (?, ?, ?, ?, ?)`,
        ['Baehive Admin', 'admin@baehive.club', '+919876543210', hashedPassword, 'https://api.dicebear.com/7.x/adventurer/svg?seed=admin']
      );
      console.log('✅ Default admin account created: admin@baehive.club / admin123');
    } else {
      console.log('ℹ️ Admin user already exists, skipping admin seed.');
    }

    // 2. Seed some demo events if table is empty
    const eventCheck = await db.getAsync('SELECT id FROM events LIMIT 1');
    if (!eventCheck) {
      const events = [
        {
          title: "Mom & Me: Laugh, Bond & Play",
          description: "Fun conversations, interactive games, and memorable moments designed to bring moms and kids closer together.",
          category: "Social",
          image: "https://spaceandbeauty-club.s3.ap-south-1.amazonaws.com/event1.jpeg",
          location: "Chennai",
          venue: "Baehive HQ, Adyar",
          date: "2026-08-14",
          startTime: "16:00",
          endTime: "19:00",
          price: 500,
          totalSeats: 30,
          remainingSeats: 30,
          organizer: "Ananya R.",
          phone: "9876543211",
          email: "ananya@baehive.club",
          status: "upcoming",
          featured: 1,
          tags: JSON.stringify(["Moms", "Kids", "Games", "Cozy"]),
          requirements: "Please bring a water bottle and change of clothes for kids.",
          mapLink: "https://maps.google.com"
        },
        {
          title: "Movie Night & Conversations",
          description: "Watch a feel-good movie, share your thoughts, and connect with fellow women over stories that stay with you.",
          category: "Chill",
          image: "https://spaceandbeauty-club.s3.ap-south-1.amazonaws.com/event2.jpeg",
          location: "Chennai",
          venue: "Sunset Cinema Club, Besant Nagar",
          date: "2026-08-15",
          startTime: "18:00",
          endTime: "21:00",
          price: 250,
          totalSeats: 50,
          remainingSeats: 50,
          organizer: "Baehive Events Team",
          phone: "9876543212",
          email: "events@baehive.club",
          status: "upcoming",
          featured: 1,
          tags: JSON.stringify(["Movie", "Popcorn", "Chit-Chat"]),
          requirements: "Blankets or mats are welcome for lawn seating.",
          mapLink: "https://maps.google.com"
        },
        {
          title: "Tea, Talks & New Friendships (50+)",
          description: "A warm gathering for women above 50 to share stories, laugh together, and build meaningful connections.",
          category: "Wellness",
          image: "https://spaceandbeauty-club.s3.ap-south-1.amazonaws.com/event3.jpeg",
          location: "Chennai",
          venue: "The Tea Room, Nungambakkam",
          date: "2026-08-21",
          startTime: "17:00",
          endTime: "19:00",
          price: 350,
          totalSeats: 25,
          remainingSeats: 25,
          organizer: "Dr. Meenakshi S.",
          phone: "9876543213",
          email: "meenakshi@baehive.club",
          status: "upcoming",
          featured: 0,
          tags: JSON.stringify(["Seniors", "Tea", "Stories"]),
          requirements: "None",
          mapLink: "https://maps.google.com"
        }
      ];

      for (const event of events) {
        await db.runAsync(
          `INSERT INTO events (title, description, category, image, location, venue, date, startTime, endTime, price, totalSeats, remainingSeats, organizer, phone, email, status, featured, tags, requirements, mapLink)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            event.title, event.description, event.category, event.image, event.location, event.venue,
            event.date, event.startTime, event.endTime, event.price, event.totalSeats, event.remainingSeats,
            event.organizer, event.phone, event.email, event.status, event.featured, event.tags,
            event.requirements, event.mapLink
          ]
        );
      }
      console.log('✅ Default seed events created.');
    } else {
      console.log('ℹ️ Events already exist, skipping events seed.');
    }

    console.log('🌱 Seeding process complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
};

seedData();
