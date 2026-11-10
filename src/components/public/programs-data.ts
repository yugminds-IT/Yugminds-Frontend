/** The three RoboCoders tracks: one source for the tabs, the readable track section, and the Course schema. */
export const TRACK_DATA = [
  {
    id: "coding-for-kids",
    name: "Coding fundamentals",
    heading: "Coding for kids: Coding Fundamentals",
    text: "Block and text programming that builds the logic behind every app and game.",
    answer:
      "Coding Fundamentals teaches children aged 6 to 18 to program, from block coding in Scratch and Scratch Jr to text programming in Python. Students build apps and video games and learn computational thinking in an 8 to 12 week program, from beginner to advanced.",
    topics: [
      ["Block programming in Scratch and Scratch Jr.", "A game where a sprite moves and reacts"],
      ["Text programming in Python", "A program you type, run and fix"],
      ["Apps and video games", "A small app or game to share"],
      ["Computational thinking", "A big problem broken into steps"],
    ],
  },
  {
    id: "robotics-for-kids",
    name: "Robotics and electronics",
    heading: "Robotics for kids: Robotics and Electronics",
    text: "Arduino, ESP32 and sensors. Students wire, program and test robots that move.",
    answer:
      "Robotics and Electronics teaches students to wire, program and test robots using Arduino and ESP32 boards and sensors. Students build circuits, read sensors and make robots that follow lines and avoid obstacles, in an 8 to 12 week program for ages 6 to 18.",
    topics: [
      ["Wiring and testing circuits", "A circuit that lights an LED"],
      ["Programming ESP32 and Arduino boards", "A program that drives the motors"],
      ["Reading sensors", "Readings your robot can act on"],
      ["Robots that follow lines and avoid obstacles", "A robot that finds its own way"],
    ],
  },
  {
    id: "ai-and-machine-learning-for-kids",
    name: "AI and machine learning",
    heading: "AI and machine learning for kids",
    text: "Machine learning and neural network basics, taught by building apps that decide.",
    answer:
      "AI and Machine Learning teaches students to collect and label examples, train a model, predict on new inputs and understand neural network basics, by building apps that decide. It runs 8 to 12 weeks for ages 6 to 18, from beginner to advanced.",
    topics: [
      ["Collecting and labelling examples", "A labelled set of examples"],
      ["Training a model", "A model that gets more accurate"],
      ["Predicting on new inputs", "Answers for things it hasn't seen"],
      ["Neural network basics", "An idea of how the model decides"],
    ],
  },
] as const;
