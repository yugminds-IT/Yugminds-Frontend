import Link from "next/link";
import { BRAND_ORIGINS, brandHref } from "@/lib/brand-host";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import Footer from "../../../components/Footer";
import FAQAccordion from "../../../components/FAQAccordion";
import CardBotPlayground from "../../../components/public/CardBotPlayground";
import { Reveal, RevealX, HoverLift } from "../../../components/public/robo-motion";
import { JsonLd, RoboBreadcrumbs, faqPageJsonLd } from "../../../components/seo/JsonLd";
import {
  ArrowRight,
  Bluetooth,
  Brain,
  Code,
  Cpu,
  Gauge,
  Home,
  ImageIcon,
  Layers,
  Lightbulb,
  MonitorPlay,
  MonitorSmartphone,
  Puzzle,
  Radar,
  Route,
  Shapes,
  Sparkles,
  Thermometer,
  ToggleRight,
  Waves,
  WifiOff,
  Zap,
} from "lucide-react";

export const revalidate = 3600;

const products = [
  {
    id: "studio",
    icon: MonitorPlay,
    title: "RoboCoders Studio",
    description:
      "Offline desktop software for block coding, Python, AI experiments and robot control — all in one app.",
    badges: ["Ages 8+", "Works offline"],
  },
  {
    id: "robotics-kit",
    icon: Cpu,
    title: "Robotics Kit — ESP32 Edition",
    description:
      "A custom ESP32 board, sensors, motors and chassis with 40+ guided robotics, IoT and automation projects.",
    badges: ["40+ projects", "Block & C coding"],
  },
  {
    id: "play-kit",
    icon: Shapes,
    title: "RoboCoders Play Kit",
    description:
      "Screen-free coding for young kids. Lay out direction cards and the robot follows them, step by step.",
    badges: ["Screen-free", "Learn by playing"],
  },
];

const studioFeatures = [
  {
    icon: Layers,
    title: "Coding, AI & Robotics — All in One",
    description:
      "Switch between block coding, Python, AI experiments, and robotics controls without juggling multiple apps.",
  },
  {
    icon: WifiOff,
    title: "Works 100% Offline",
    description:
      "Runs entirely on the device — perfect for classrooms with limited connectivity or at-home learning.",
  },
  {
    icon: MonitorPlay,
    title: "Interactive & Guided Learning",
    description:
      "Step-by-step lessons, live visual feedback, and built-in project challenges from the very first session.",
  },
  {
    icon: Brain,
    title: "Designed for Ages 8+",
    description:
      "Beginner-friendly enough to start, deep enough to keep students challenged for years.",
  },
];

const kitStats = [
  { value: "40+", label: "Guided projects" },
  { value: "15+", label: "Components" },
  { value: "5", label: "Robot types" },
  { value: "Wi-Fi + BT", label: "Wireless control" },
];

const kitHighlights = [
  { icon: Code, text: "Block-based coding & C programming" },
  { icon: MonitorSmartphone, text: "Works with laptops, desktops & Chromebooks" },
  { icon: Radar, text: "IR, Ultrasonic, LDR & DHT11 sensors included" },
  { icon: Route, text: "Obstacle, line, light, object-following & maze-solver robots" },
  { icon: Lightbulb, text: "OLED display, LEDs & buzzer outputs" },
  { icon: Zap, text: "Labelled pins for easy, safe connections" },
];

const components = [
  { name: "Custom ESP32 Board", use: "The robot’s brain — runs code, reads sensors, drives motors, Wi-Fi & Bluetooth." },
  { name: "IR Sensors", use: "Line following, edge detection and maze solving." },
  { name: "Ultrasonic Sensor", use: "Obstacle avoiding, object following and distance meters." },
  { name: "LDR Light Sensor", use: "Light-following robots and light alerts." },
  { name: "DHT11 Sensor", use: "Temperature & humidity monitoring, smart fans." },
  { name: "OLED Display", use: "Shows direction, distance, temperature and water level." },
  { name: "BO Gear Motors", use: "Controlled movement and speed for the 4-wheel chassis." },
  { name: "Servo Motor", use: "Toll gates, switches and small robotic arms." },
  { name: "DC Motor + Propeller", use: "Cooling fans and fire-control models." },
  { name: "Buzzer", use: "Alarms for obstacles, lines and water levels." },
  { name: "LEDs", use: "Visual indicators and status signals." },
  { name: "4-Wheel Acrylic Chassis", use: "Holds the board, motors and sensors together." },
  { name: "Wheels (x4)", use: "Traction and stability for every mobile robot." },
  { name: "Wires & USB Cable", use: "Power and signal connections to the ESP32." },
  { name: "Screws, Nuts & Bolts", use: "Complete robot assembly and sensor mounting." },
];

const projectCategories = [
  { icon: Lightbulb, title: "Output & Display", examples: "LED on/off, OLED direction indicator, distance & water-level meters" },
  { icon: Radar, title: "Sensor Detection", examples: "Light detector, object & motion detector, digital distance meter" },
  { icon: Gauge, title: "Movement Patterns", examples: "Random, spiral and all-direction movements, left-right solver" },
  { icon: Route, title: "IR Robots", examples: "Line follower, table-edge detector, maze solvers" },
  { icon: Waves, title: "Ultrasonic Robots", examples: "Obstacle avoider, object follower, distance-measuring robot" },
  { icon: Sparkles, title: "Light-Following Robots", examples: "Light follower with buzzer, obstacle + light follower" },
  { icon: Bluetooth, title: "Wireless Control", examples: "Bluetooth-controlled robot car" },
  { icon: ToggleRight, title: "Servo Projects", examples: "Toll gate system, switch-on using servo" },
  { icon: Home, title: "Home Automation", examples: "Motion-activated light, parking management system" },
  { icon: Thermometer, title: "Environment", examples: "Water-level monitor, fire control, temperature-monitoring bot" },
];

const playSteps = [
  {
    icon: Shapes,
    title: "Lay out the cards",
    description: "Kids arrange direction cards — Forward, Left, Right, U-Turn — in the order they want.",
  },
  {
    icon: Puzzle,
    title: "The robot reads them",
    description: "Place a card on the robot and it recognises the command — no screen, no typing.",
  },
  {
    icon: Route,
    title: "Watch it move",
    description: "Right card, it turns right. U-Turn card, it turns around. Kids see their logic come alive.",
  },
];

const faqs = [
  {
    question: "What products does RoboCoders offer?",
    answer:
      "RoboCoders, the EdTech initiative of YugMinds, offers three products: RoboCoders Studio (offline desktop software for coding, AI and robotics), the YugMinds Robotics Kit — ESP32 Edition (a hands-on robotics and IoT kit with 40+ guided projects), and the RoboCoders Play Kit (a screen-free, card-controlled coding robot for young kids).",
  },
  {
    question: "What is RoboCoders Studio?",
    answer:
      "RoboCoders Studio is a desktop app that brings block coding, Python, AI experiments and robot control into one place. It is designed for students aged 8 and above and works completely offline, so it suits classrooms with limited internet as well as learning at home.",
  },
  {
    question: "Does RoboCoders Studio need an internet connection?",
    answer:
      "No. RoboCoders Studio runs entirely on the device, so students can learn coding, AI and robotics with zero internet required.",
  },
  {
    question: "What is included in the YugMinds ESP32 Robotics Kit?",
    answer:
      "The kit includes a custom ESP32 development board, IR sensors, an ultrasonic sensor, an LDR light sensor, a DHT11 temperature and humidity sensor, an OLED display, BO gear motors, a servo motor, a DC motor with propeller, a buzzer, LEDs, a 4-wheel acrylic chassis with wheels, wires, a USB cable, and screws, nuts and bolts for assembly.",
  },
  {
    question: "How many projects can students build with the ESP32 Robotics Kit?",
    answer:
      "Students can build 40+ guided projects, from LED and OLED display basics to line-following, obstacle-avoiding, light-following and maze-solving robots, Bluetooth-controlled cars, servo projects, home automation models and environment monitors.",
  },
  {
    question: "Which coding languages and devices does the robotics kit support?",
    answer:
      "The kit supports block-based coding and C programming, and works with laptops, desktops and Chromebooks. The ESP32 board also has built-in Wi-Fi and Bluetooth for wireless projects.",
  },
  {
    question: "How does the RoboCoders Play Kit work?",
    answer:
      "Kids control the robot with direction cards such as Forward, Left, Right and U-Turn. They place a card on the robot and it carries out that command — a Right card turns it right, a U-Turn card turns it around. This teaches sequencing, logic and problem-solving without any screen.",
  },
  {
    question: "Can schools order RoboCoders products in bulk?",
    answer:
      "Yes. Schools can contact the RoboCoders team for bulk orders, product demos and classroom packages for RoboCoders Studio, the ESP32 Robotics Kit and the Play Kit.",
  },
];

const productListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "RoboCoders Products",
  itemListElement: products.map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: p.title,
    description: p.description,
    url: `${BRAND_ORIGINS.robocoders}/products#${p.id}`,
  })),
};

export default function ProductsPage() {
  const contactHref = brandHref("/robocoders/contact");

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={productListJsonLd} />
      <JsonLd data={faqPageJsonLd(faqs)} />
      <RoboBreadcrumbs
        crumbs={[
          { name: "RoboCoders", path: "/" },
          { name: "Products", path: "/products" },
        ]}
      />

      {/* 1. Hero — WHITE */}
      <section className="min-h-screen flex items-center bg-white pt-24 lg:pt-28 pb-16 px-4">
        <div className="container">
          <Reveal>
            <div className="text-center mb-10 md:mb-14">
              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-extrabold mb-4 md:mb-6 max-w-6xl mx-auto text-gray-900">
                Our <span className="text-blue-600">Products</span>
              </h1>
              <p className="text-lg md:text-xl lg:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Software, robotics kits and playful learning tools — designed by YugMinds to make coding,
                AI and robotics hands-on for every age.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {products.map(({ id, icon: Icon, title, description, badges }, idx) => (
              <HoverLift key={id} delay={idx * 0.1}>
                <a href={`#${id}`} className="block h-full">
                  <Card className="bg-blue-600 border-0 shadow-lg rounded-3xl h-full group">
                    <CardContent className="p-6 md:p-8 flex flex-col h-full">
                      <div className="flex items-start gap-4 md:gap-5 mb-4 md:mb-5">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                          <Icon className="h-8 w-8 md:h-9 md:w-9 text-white" />
                        </div>
                        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">{title}</h2>
                      </div>
                      <p className="text-blue-100 text-sm md:text-base leading-relaxed mb-6">{description}</p>
                      <div className="mt-auto flex items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          {badges.map((badge) => (
                            <span
                              key={badge}
                              className="px-3 py-1.5 bg-white/20 text-white rounded-full text-xs md:text-sm font-medium whitespace-nowrap"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                        <ArrowRight className="h-6 w-6 text-white flex-shrink-0 transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </a>
              </HoverLift>
            ))}
          </div>
        </div>
      </section>

      {/* 2. RoboCoders Studio — BLUE */}
      <section id="studio" className="scroll-mt-20 py-24 bg-blue-600 px-4">
        <div className="container max-w-7xl mx-auto">
          <Reveal>
            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-2 bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full border border-white/30">
                <WifiOff className="h-4 w-4" />
                RoboCoders Studio — Desktop Software
              </span>
            </div>
            <div className="text-center mb-14">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-5 max-w-4xl mx-auto leading-tight">
                One App. Coding, AI &amp; Robotics.{" "}
                <span className="text-amber-300">Completely Offline.</span>
              </h2>
              <p className="text-lg md:text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
                RoboCoders Studio brings everything kids need to learn programming, artificial intelligence
                and robotics into one place — with zero internet required.
              </p>
            </div>
          </Reveal>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <RevealX
              x={-48}
              className="relative rounded-3xl overflow-hidden border-2 border-dashed border-white/30 bg-white/10 flex flex-col items-center justify-center min-h-[380px] md:min-h-[460px]"
            >
              <div className="text-center px-8 py-12">
                <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-5">
                  <ImageIcon className="h-9 w-9 text-white/70" />
                </div>
                <p className="text-white font-semibold text-lg">RoboCoders Studio screenshot</p>
                <p className="text-blue-200 text-sm mt-1">Image coming soon</p>
              </div>
            </RevealX>

            <RevealX x={48} className="flex flex-col gap-6">
              {studioFeatures.map(({ icon: Icon, title, description }) => (
                <div key={title} className="group flex gap-4 items-start">
                  <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
                    <p className="text-blue-100 text-sm leading-relaxed">{description}</p>
                  </div>
                </div>
              ))}
              <div className="mt-4">
                <Link href={contactHref}>
                  <Button size="lg" className="bg-white hover:bg-gray-100 text-blue-600 h-12 px-8 text-base font-bold w-full sm:w-auto rounded-full transition-transform hover:scale-105">
                    Get Early Access
                  </Button>
                </Link>
              </div>
            </RevealX>
          </div>
        </div>
      </section>

      {/* 3. Robotics Kit — WHITE */}
      <section id="robotics-kit" className="scroll-mt-20 py-24 bg-white px-4">
        <div className="container max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-sm font-semibold px-4 py-2 rounded-full border border-blue-100 mb-6">
                <Cpu className="h-4 w-4" />
                YugMinds Robotics Kit — ESP32 Edition
              </span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-5 max-w-4xl mx-auto leading-tight">
                Build, Code &amp; Control <span className="text-blue-600">Real Robots</span>
              </h2>
              <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Powered by a custom ESP32 board with Wi-Fi, Bluetooth, motor control and sensor ports — the kit
                takes students from their first LED to self-driving, maze-solving robots.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-16">
            {kitStats.map(({ value, label }, idx) => (
              <HoverLift key={label} delay={idx * 0.08}>
                <div className="rounded-3xl border-2 border-blue-100 bg-blue-50/60 p-6 text-center h-full">
                  <div className="text-3xl md:text-4xl font-extrabold text-blue-600">{value}</div>
                  <div className="text-gray-600 font-medium mt-1">{label}</div>
                </div>
              </HoverLift>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-10 md:gap-12 items-center mb-20">
            <RevealX x={-48}>
              <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-6">What makes it special</h3>
              <ul className="space-y-4 mb-8">
                {kitHighlights.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="mt-0.5 w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-white" />
                    </span>
                    <span className="text-gray-800 font-medium pt-1.5">{text}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href={contactHref}>
                  <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white h-12 px-8 text-base font-bold rounded-full transition-transform hover:scale-105">
                    Order Robotics Kit
                  </Button>
                </Link>
                <Link href={brandHref("/robocoders/for-schools")}>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-blue-600 text-blue-600 hover:bg-blue-50 h-12 px-8 text-base font-bold rounded-full">
                    For Schools
                  </Button>
                </Link>
              </div>
            </RevealX>
            <RevealX x={48} className="bg-blue-600 rounded-3xl overflow-hidden w-full max-w-[408px] mx-auto shadow-xl">
              <video
                src="/instagram-reel.mp4"
                autoPlay
                loop
                muted
                playsInline
                title="YugMinds ESP32 robotics kit demo"
                aria-label="YugMinds ESP32 robotics kit demo"
                className="w-full h-auto"
              />
            </RevealX>
          </div>

          <Reveal>
            <h3 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 text-center mb-3">
              What&apos;s in the box
            </h3>
            <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto md:text-lg">
              Every component is labelled and explained, so students know exactly what each part does.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-20">
            {components.map(({ name, use }, idx) => (
              <HoverLift key={name} delay={(idx % 3) * 0.06}>
                <div className="h-full rounded-2xl border-2 border-blue-100 bg-white p-5 shadow-sm hover:shadow-lg transition-shadow">
                  <div className="font-bold text-gray-900 mb-1">{name}</div>
                  <p className="text-sm text-gray-600 leading-relaxed">{use}</p>
                </div>
              </HoverLift>
            ))}
          </div>

          <Reveal>
            <h3 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 text-center mb-3">
              40+ projects, from first LED to maze solver
            </h3>
            <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto md:text-lg">
              Guided projects grouped by skill, so students level up one concept at a time.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
            {projectCategories.map(({ icon: Icon, title, examples }, idx) => (
              <HoverLift key={title} delay={(idx % 5) * 0.06}>
                <Card className="bg-blue-600 border-0 rounded-3xl h-full group shadow-md">
                  <CardContent className="p-5">
                    <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="font-bold text-white mb-1.5">{title}</div>
                    <p className="text-blue-100 text-sm leading-relaxed">{examples}</p>
                  </CardContent>
                </Card>
              </HoverLift>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Play Kit — BLUE */}
      <section id="play-kit" className="scroll-mt-20 py-24 bg-blue-600 px-4">
        <div className="container max-w-7xl mx-auto">
          <Reveal>
            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-2 bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full border border-white/30">
                <Shapes className="h-4 w-4" />
                RoboCoders Play Kit — Screen-free Coding
              </span>
            </div>
            <div className="text-center mb-14">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-5 max-w-4xl mx-auto leading-tight">
                Code with Cards. <span className="text-amber-300">No Screen Needed.</span>
              </h2>
              <p className="text-lg md:text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
                Young kids control the robot by placing direction cards on it. Each card is a command — so they
                learn sequencing, logic and problem-solving just by playing.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-16">
            {playSteps.map(({ icon: Icon, title, description }, idx) => (
              <HoverLift key={title} delay={idx * 0.1}>
                <div className="h-full rounded-3xl bg-white/10 border border-white/20 p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-10 h-10 rounded-full bg-amber-300 text-blue-900 font-extrabold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{title}</h3>
                  <p className="text-blue-100 leading-relaxed">{description}</p>
                </div>
              </HoverLift>
            ))}
          </div>

          <Reveal>
            <h3 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white text-center mb-3">
              Try it yourself
            </h3>
            <p className="text-blue-100 text-center mb-8 max-w-2xl mx-auto md:text-lg">
              This is exactly how the Play Kit works — pick your cards and run the robot.
            </p>
          </Reveal>
          <Reveal>
            <CardBotPlayground />
          </Reveal>
        </div>
      </section>

      {/* 5. FAQ — GRAY */}
      <section className="bg-gray-50 py-24 px-4">
        <div className="container">
          <Reveal>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-center mb-8 md:mb-10 max-w-5xl mx-auto text-gray-900">
              Frequently Asked Questions
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <FAQAccordion faqs={faqs} />
          </Reveal>
        </div>
      </section>

      {/* 6. CTA — BLUE */}
      <section className="py-24 bg-blue-600 px-4">
        <Reveal className="container text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-4 md:mb-6 text-white max-w-5xl mx-auto">
            Bring RoboCoders Products to Your School
          </h2>
          <p className="text-blue-100 mb-8 md:mb-10 max-w-2xl mx-auto text-base md:text-lg xl:text-xl">
            Talk to our team about bulk orders, demos and classroom packages for any of our products.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={contactHref}>
              <Button size="lg" className="bg-white hover:bg-gray-100 text-blue-600 px-8 md:px-10 py-5 md:py-6 text-base md:text-lg h-auto font-bold shadow-xl rounded-full transition-transform hover:scale-105 w-full sm:w-auto">
                Request a Demo
              </Button>
            </Link>
            <Link href={brandHref("/robocoders/programs")}>
              <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10 hover:text-white px-8 md:px-10 py-5 md:py-6 text-base md:text-lg h-auto font-bold rounded-full w-full sm:w-auto">
                Explore Programs
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
