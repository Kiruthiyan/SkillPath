import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Brain, Target, Users, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/use-page-title";

const features = [
  {
    icon: Target,
    title: "Smart Recommendations",
    description: "Get course matches based on your A/L stream and Z-score.",
  },
  {
    icon: BookOpen,
    title: "Explore Courses",
    description: "Browse degrees across Sri Lankan state universities with filters.",
  },
  {
    icon: Brain,
    title: "AI Career Roadmap",
    description: "Generate personalized year-by-year plans for your chosen degree.",
  },
  {
    icon: Users,
    title: "Alumni Insights",
    description: "Read reviews and success stories from graduates in your field.",
  },
];

export default function Home() {
  usePageTitle();
  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-b from-[hsl(213,52%,25%)] to-[hsl(213,52%,18%)] text-white">
        <div className="mx-auto max-w-6xl px-4 py-24 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Find your path to university success
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8">
              SkillPath AI helps Sri Lankan students discover courses, plan careers, and get AI-powered guidance.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/profile">
                  Set Up Profile <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                <Link href="/courses">Browse Courses</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need to decide</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full">
                <CardHeader>
                  <feature.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="bg-muted py-16">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to start?</h2>
          <p className="text-muted-foreground mb-6">Create your profile and get personalized recommendations today.</p>
          <Button size="lg" asChild>
            <Link href="/register">Get Started Free</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
