export type FaqCat = "start" | "plans" | "schools" | "kits";

// Every answer restates something already on the site (programs, products, for-schools and for-parents pages).
export const FAQS: { cat: FaqCat; q: string; a: string }[] = [
  { cat: "start", q: "What ages do you teach?", a: "Programs cover ages 6 to 18, from beginner to advanced. The offline Studio software is for ages 8 and above." },
  { cat: "start", q: "What will my child learn?", a: "Three tracks: coding fundamentals with block and text programming, robotics and electronics with Arduino, ESP32 and sensors, and AI and machine learning basics taught by building apps that decide." },
  { cat: "start", q: "What is the best age to start coding?", a: "Children can start from age 6. Beginners aged 6 to 12 usually start with block coding in Scratch, and older students can go straight to Python, robotics or AI. There is no age that is too late." },
  { cat: "start", q: "Does RoboCoders offer online coding classes?", a: "Yes. Learners anywhere in India can join online with live 1:1 tutors or self-paced courses, starting with a free trial class. RoboCoders is based in Begumpet, Hyderabad." },
  { cat: "start", q: "Do you teach Python and Scratch?", a: "Yes. Coding Fundamentals covers block programming in Scratch and Scratch Jr, then text programming in Python, plus apps and games." },
  { cat: "start", q: "How long is a program?", a: "Programs run 8 to 12 weeks, from beginner to advanced." },
  { cat: "start", q: "Can we try a class first?", a: "Yes. Start with a free trial class, meet a tutor one on one, then choose the program that fits." },
  { cat: "plans", q: "Does my child need internet?", a: "RoboCoders Studio has an offline version that works without internet, made for schools. Students who practise at home can use the online version. Online classes need a connection." },
  { cat: "plans", q: "Do students get a certificate?", a: "Yes. Finishing a course earns a certificate that anyone can verify online, and students keep lifetime access to the material." },
  { cat: "plans", q: "What does it cost?", a: "Plans start at ₹999 per course, with ₹1,499 per semester and ₹1,999 per year options." },
  { cat: "schools", q: "Can our school run RoboCoders?", a: "Yes. We handle setup and instructor training, then launch classes and track progress with you. A school starts with a consultation, then customization, setup and launch." },
  { cat: "schools", q: "Who teaches the classes?", a: "Trained RoboCoders instructors can teach independently or co-teach with your staff. Kits, textbooks and LMS access are included, and 24/7 tech support backs every class." },
  { cat: "schools", q: "Can schools order in bulk?", a: "Yes. Schools can contact the RoboCoders team for bulk orders, product demos and classroom packages." },
  { cat: "kits", q: "What is in the Robotics Kit?", a: "A custom ESP32 board, sensors, motors and a chassis, with 40+ guided projects. It supports block and C coding and works with laptops, desktops and Chromebooks. Contact us for the full kit details." },
  { cat: "kits", q: "What is the Junior Robotics Kit?", a: "A no-code robotics kit for grades 1 to 3. Children press a button and make lights and sounds happen, which teaches how inputs and outputs work. No screen and no coding needed." },
  { cat: "kits", q: "Is there a screen-free option for young kids?", a: "Yes. The RoboCoders Play Kit teaches coding without a screen: kids lay out direction cards and the robot follows them." },
];
