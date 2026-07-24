const db = require('../database/db');

// GET /api/dashboard
const getDashboardStats = async (req, res) => {
  try {
    // 1. Core counters
    const totalEvents = await db.getAsync('SELECT COUNT(*) as count FROM events WHERE isDeleted = 0');
    const upcomingEvents = await db.getAsync("SELECT COUNT(*) as count FROM events WHERE isDeleted = 0 AND status = 'upcoming'");
    const completedEvents = await db.getAsync("SELECT COUNT(*) as count FROM events WHERE isDeleted = 0 AND status = 'completed'");
    
    const registrations = await db.getAsync("SELECT SUM(tickets) as totalTickets, COUNT(*) as count FROM registrations WHERE paymentStatus = 'completed'");
    const totalRevenue = await db.getAsync("SELECT SUM(amount) as revenue FROM registrations WHERE paymentStatus = 'completed'");

    // 2. Revenue Breakdown: Today, Weekly, Monthly, Total
    const todayRevenue = await db.getAsync(`
      SELECT SUM(amount) as revenue 
      FROM registrations 
      WHERE paymentStatus = 'completed' 
        AND date(createdAt) = date('now')
    `);

    const weeklyRevenue = await db.getAsync(`
      SELECT SUM(amount) as revenue 
      FROM registrations 
      WHERE paymentStatus = 'completed' 
        AND createdAt >= datetime('now', '-7 days')
    `);

    const monthlyRevenue = await db.getAsync(`
      SELECT SUM(amount) as revenue 
      FROM registrations 
      WHERE paymentStatus = 'completed' 
        AND createdAt >= datetime('now', '-30 days')
    `);

    // 3. Recharts Chart data: Monthly Revenue & Registrations (Last 6 months)
    const chartData = await db.allAsync(`
      SELECT 
        strftime('%Y-%m', createdAt) as month,
        SUM(amount) as revenue,
        SUM(tickets) as registrations
      FROM registrations
      WHERE paymentStatus = 'completed'
        AND createdAt >= datetime('now', '-6 months')
      GROUP BY month
      ORDER BY month ASC
    `);

    // Format chart months for UI friendly display (e.g. "2026-07" to "Jul")
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedChartData = chartData.map(item => {
      const [year, month] = item.month.split('-');
      const monthIdx = parseInt(month, 10) - 1;
      return {
        name: `${monthNames[monthIdx]} ${year.substring(2)}`,
        revenue: item.revenue || 0,
        registrations: item.registrations || 0,
      };
    });

    // 4. Recent Payments (latest 5)
    const recentPayments = await db.allAsync(`
      SELECT r.*, e.title as eventName
      FROM registrations r
      JOIN events e ON r.eventId = e.id
      ORDER BY r.createdAt DESC
      LIMIT 5
    `);

    // 5. Latest Events (latest 5)
    const latestEvents = await db.allAsync(`
      SELECT * FROM events 
      WHERE isDeleted = 0 
      ORDER BY createdAt DESC 
      LIMIT 5
    `);

    res.json({
      success: true,
      stats: {
        totalEvents: totalEvents.count || 0,
        upcomingEvents: upcomingEvents.count || 0,
        completedEvents: completedEvents.count || 0,
        totalRegistrations: registrations.totalTickets || 0,
        registrationRecords: registrations.count || 0,
        totalRevenue: totalRevenue.revenue || 0,
        todayRevenue: todayRevenue.revenue || 0,
        weeklyRevenue: weeklyRevenue.revenue || 0,
        monthlyRevenue: monthlyRevenue.revenue || 0,
      },
      chartData: formattedChartData,
      recentPayments,
      latestEvents: latestEvents.map(e => ({
        ...e,
        tags: e.tags ? JSON.parse(e.tags) : [],
        featured: e.featured === 1
      }))
    });
  } catch (err) {
    console.error('Get dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { getDashboardStats };
