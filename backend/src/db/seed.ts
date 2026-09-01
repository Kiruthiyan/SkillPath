import bcrypt from "bcryptjs";
import { db, pool } from "./client";
import {
  careerPathsTable,
  alumniReviewsTable,
  successStoriesTable,
  degreeProgrammesTable,
  universitiesTable,
  usersTable,
} from "./schema/index";
import { like, eq } from "drizzle-orm";

async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("  Skipping admin bootstrap (ADMIN_EMAIL/ADMIN_PASSWORD not set).");
    return;
  }

  const normalizedEmail = email.toLowerCase();
  const [existing] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail));

  if (existing) {
    if (existing.role !== "admin") {
      await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, existing.id));
      console.log(`  Promoted existing user ${normalizedEmail} to admin.`);
    } else {
      console.log(`  ${normalizedEmail} is already an admin.`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(usersTable).values({
    email: normalizedEmail,
    passwordHash,
    name: "Admin",
    language: "en",
    role: "admin",
  });
  console.log(`  Created admin user ${normalizedEmail}.`);
}

async function findProgramme(degreePattern: string) {
  const [row] = await db
    .select({ id: degreeProgrammesTable.id, universityId: degreeProgrammesTable.universityId })
    .from(degreeProgrammesTable)
    .where(like(degreeProgrammesTable.degreeName, degreePattern))
    .limit(1);
  return row ?? null;
}

async function seed() {
  console.log("Seeding SkillPath AI database (careers, reviews, stories only)...");

  await db.delete(successStoriesTable);
  await db.delete(alumniReviewsTable);
  await db.delete(careerPathsTable);

  await db.insert(careerPathsTable).values([
    {
      title: "Software Engineer",
      degreeType: "Science",
      salaryMin: 80000,
      salaryMax: 350000,
      growthPotential: "High",
      industryDemand: "Very High",
      description:
        "Design, develop, and maintain software applications for local and international companies.",
    },
    {
      title: "Data Analyst",
      degreeType: "Science",
      salaryMin: 70000,
      salaryMax: 250000,
      growthPotential: "Very High",
      industryDemand: "High",
      description:
        "Analyze data to help businesses make informed decisions using SQL, Python, and visualization tools.",
    },
    {
      title: "Business Analyst",
      degreeType: "Commerce",
      salaryMin: 60000,
      salaryMax: 200000,
      growthPotential: "High",
      industryDemand: "High",
      description:
        "Bridge business needs and technology solutions in banking, telecom, and corporate sectors.",
    },
    {
      title: "UI/UX Designer",
      degreeType: "Science",
      salaryMin: 65000,
      salaryMax: 220000,
      growthPotential: "High",
      industryDemand: "Growing",
      description:
        "Create user-friendly digital experiences for web and mobile applications.",
    },
    {
      title: "Network Engineer",
      degreeType: "Engineering",
      salaryMin: 75000,
      salaryMax: 280000,
      growthPotential: "Moderate",
      industryDemand: "High",
      description:
        "Design and maintain network infrastructure for enterprises and ISPs.",
    },
    {
      title: "Cybersecurity Analyst",
      degreeType: "Science",
      salaryMin: 90000,
      salaryMax: 400000,
      growthPotential: "Very High",
      industryDemand: "Very High",
      description:
        "Protect organizations from cyber threats through monitoring, analysis, and incident response.",
    },
    {
      title: "Civil Engineer",
      degreeType: "Engineering",
      salaryMin: 80000,
      salaryMax: 300000,
      growthPotential: "Moderate",
      industryDemand: "High",
      description:
        "Design and oversee construction of infrastructure projects across Sri Lanka.",
    },
    {
      title: "Medical Doctor",
      degreeType: "Medicine",
      salaryMin: 100000,
      salaryMax: 500000,
      growthPotential: "Stable",
      industryDemand: "Very High",
      description:
        "Provide healthcare in government hospitals or private practice after MBBS and internship.",
    },
  ]);

  const itProgramme = await findProgramme("%Information Technology%");
  const csProgramme = await findProgramme("%Computer Science%");
  const engProgramme = await findProgramme("%Engineering Technology%");
  const commerceProgramme = await findProgramme("%Accounting%");

  if (itProgramme) {
    const [moratuwa] = await db
      .select({ id: universitiesTable.id })
      .from(universitiesTable)
      .where(like(universitiesTable.name, "%Moratuwa%"))
      .limit(1);

    await db.insert(alumniReviewsTable).values([
      {
        reviewerName: "Nimal Perera",
        universityId: moratuwa?.id ?? itProgramme.universityId,
        courseId: itProgramme.id,
        graduationYear: 2020,
        currentPosition: "Senior Software Engineer",
        company: "WSO2",
        reviewText:
          "Moratuwa IT gave me a solid foundation. The internship program was invaluable. I landed my first job within 2 months of graduating.",
        rating: 5,
        isVerified: true,
        avatarColor: "#0d9488",
      },
    ]);

    await db.insert(successStoriesTable).values([
      {
        name: "Tharindu Jayawardena",
        courseId: itProgramme.id,
        graduationYear: 2018,
        currentPosition: "Engineering Manager at Google (Singapore)",
        summary:
          "From Moratuwa IT graduate to leading engineering teams at a global tech giant.",
        careerJourney: JSON.stringify([
          "2018: Graduated BSc IT from University of Moratuwa",
          "2019: Junior Developer at Virtusa",
          "2021: Software Engineer at Grab (Singapore)",
          "2023: Senior Engineer at Google",
          "2025: Engineering Manager at Google Singapore",
        ]),
        avatarColor: "#0d9488",
      },
    ]);
  }

  if (csProgramme) {
    await db.insert(alumniReviewsTable).values([
      {
        reviewerName: "Kavindi Silva",
        universityId: csProgramme.universityId,
        courseId: csProgramme.id,
        graduationYear: 2019,
        currentPosition: "Data Scientist",
        company: "Dialog Axiata",
        reviewText:
          "Computer Science is rigorous but rewarding. The theoretical depth helped me transition into data science easily.",
        rating: 5,
        isVerified: true,
        avatarColor: "#1e3a5f",
      },
    ]);
  }

  if (engProgramme) {
    await db.insert(alumniReviewsTable).values([
      {
        reviewerName: "Rajan Kumar",
        universityId: engProgramme.universityId,
        courseId: engProgramme.id,
        graduationYear: 2018,
        currentPosition: "Project Engineer",
        company: "Access Engineering",
        reviewText:
          "Engineering at Moratuwa is world-class. The campus culture and industry connections are unmatched in Sri Lanka.",
        rating: 4,
        isVerified: true,
        avatarColor: "#7c3aed",
      },
    ]);
  }

  if (commerceProgramme) {
    await db.insert(alumniReviewsTable).values([
      {
        reviewerName: "Dilani Fernando",
        universityId: commerceProgramme.universityId,
        courseId: commerceProgramme.id,
        graduationYear: 2021,
        currentPosition: "Management Trainee",
        company: "Commercial Bank",
        reviewText:
          "Great faculty and networking opportunities. Combined with CIMA, this degree opened many doors in banking.",
        rating: 4,
        isVerified: true,
        avatarColor: "#dc2626",
      },
    ]);
  }

  await ensureAdminUser();

  console.log("Seed completed successfully!");
  console.log("  Note: Run pnpm handbook:import to load UGC programme data first.");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
