"use client";

import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { useAutoSaveForm } from "../../../hooks/useAutoSaveForm";
import { loadFormData, clearFormData } from "../../../lib/form-persistence";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import Footer from "../../../components/Footer";
import { Reveal, HoverLift } from "../../../components/public/robo-motion";
import { commonApi } from "../../../lib/api";
import { toast } from "../../../components/ui/toast";
import { 
  Phone,
  Mail,
  Clock,
  MapPin,
  Instagram,
  Youtube,
  Facebook
} from "lucide-react";

export default function ContactPage() {
  // Load saved contact form data
  const savedFormData = typeof window !== 'undefined'
    ? loadFormData<{
        firstName: string;
        lastName: string;
        areaCode: string;
        phoneNumber: string;
        email: string;
        purpose: string;
        message: string;
      }>('contact-form')
    : null;

  const [formData, setFormData] = useState(savedFormData || {
    firstName: "",
    lastName: "",
    areaCode: "+91",
    phoneNumber: "",
    email: "",
    purpose: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-save contact form
  const { clearSavedData } = useAutoSaveForm({
    formId: 'contact-form',
    formData,
    autoSave: true,
    autoSaveInterval: 2000,
    debounceDelay: 500,
    useSession: false,
    onLoad: (data) => {
      if (data && !savedFormData) {
        setFormData(data);
      }
    },
    markDirty: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await commonApi.contact(formData);

      // Clear saved form data after successful submission
      clearFormData('contact-form');
      clearSavedData();

      toast.success("Thank you for your message! We'll get back to you soon.");
      setFormData({
        firstName: "",
        lastName: "",
        areaCode: "+91",
        phoneNumber: "",
        email: "",
        purpose: "",
        message: ""
      });
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error(error instanceof Error ? error.message : "Network error: Please check your internet connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation */}

      {/* Combined Get in Touch & Find Us Section */}
      <section className="min-h-screen flex flex-col m-0">
        {/* Get in Touch Section */}
        <div className="flex-1 flex items-start justify-center bg-gray-50 flex-shrink-0 py-8 md:py-12 min-h-0">
          <div className="container w-full py-4 md:py-6">
            <Reveal>
              <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 md:mb-4 text-center max-w-5xl mx-auto">
                Get in <span className="text-blue-600">Touch</span>
              </h1>
              <p className="text-sm md:text-base lg:text-lg text-gray-700 mb-4 md:mb-6 max-w-2xl mx-auto leading-relaxed text-center">
                Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll respond as soon as possible.
              </p>
            </Reveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[
                { icon: Phone, title: "Phone", a: "+91 85003 45655", b: "Mon-Fri, 9am-6pm EST" },
                { icon: Mail, title: "Email", a: "robocoders07@gmail.com", b: "We reply within 24 hours" },
                { icon: Clock, title: "Office Hours", a: "Mon-Fri: 9am-6pm", b: "Saturday: 10am-4pm" },
              ].map(({ icon: Icon, title, a, b }, idx) => (
                <HoverLift key={title} delay={idx * 0.1}>
                <Card className="bg-blue-600 text-white border-0 rounded-3xl h-full group">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{title}</h3>
                    <p className="text-white/90 mb-1">{a}</p>
                    <p className="text-white/70 text-sm">{b}</p>
                  </CardContent>
                </Card>
                </HoverLift>
              ))}
            </div>
          </div>
        </div>

        {/* Find Us Section */}
        <div className="bg-blue-600 py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6 lg:px-8">

            {/* Heading */}
            <Reveal>
            <div className="text-center mb-10 md:mb-14">
              <span className="inline-flex items-center gap-2 bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full border border-white/30 mb-4">
                <MapPin className="h-4 w-4" />
                Our Location
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-3">
                Find Us
              </h2>
              <p className="text-white/80 text-lg max-w-xl mx-auto">
                Come visit us in Hyderabad — we&apos;d love to meet you in person.
              </p>
            </div>
            </Reveal>

            {/* Two-column: info left, map right */}
            <div className="grid lg:grid-cols-5 gap-6 md:gap-8 items-stretch max-w-6xl mx-auto">

              {/* Info card */}
              <Reveal className="lg:col-span-2 bg-white rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-xl">

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 mb-1">Address</p>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Begumpet, Hyderabad,<br />Telangana, India.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Phone className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 mb-1">Phone</p>
                    <p className="text-gray-600 text-sm">+91 85003 45655</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 mb-1">Email</p>
                    <p className="text-gray-600 text-sm">robocoders07@gmail.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 mb-1">Office Hours</p>
                    <p className="text-gray-600 text-sm">Mon–Fri: 9am – 6pm</p>
                    <p className="text-gray-600 text-sm">Saturday: 10am – 4pm</p>
                  </div>
                </div>

                <a
                  href="https://www.google.com/maps?q=17.447081,78.460012"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors duration-200 text-sm"
                >
                  <MapPin className="h-4 w-4" />
                  Open in Google Maps
                </a>
              </Reveal>

              {/* Map */}
              <Reveal delay={0.1} className="lg:col-span-3 rounded-2xl overflow-hidden shadow-xl min-h-[340px] md:min-h-[420px]">
                <iframe
                  src="https://maps.google.com/maps?q=17.447081,78.460012&hl=en&z=15&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0, display: "block", minHeight: "340px" }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Robo Coders Location"
                />
              </Reveal>

            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="min-h-screen flex items-center justify-center bg-gray-50 py-20">
        <div className="container py-8 px-4 md:px-8 lg:px-12 xl:px-16">
          <Reveal>
            <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-8 md:mb-10 text-center max-w-5xl mx-auto">Contact Us</h2>
          </Reveal>
          <Reveal delay={0.1} className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-10">
          <form onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 mb-6 md:mb-8">
            <div>
              <Label htmlFor="firstName" className="text-base md:text-lg font-medium">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                className="mt-2 text-base md:text-lg h-12 md:h-14"
                placeholder="John"
              />
            </div>
            <div>
              <Label htmlFor="lastName" className="text-base md:text-lg font-medium">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
                className="mt-2 text-base md:text-lg h-12 md:h-14"
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="mb-6 md:mb-8">
            <Label htmlFor="phone" className="text-base md:text-lg font-medium">
              Phone Number <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-[120px_1fr] gap-3 md:gap-4 mt-2">
              <div>
                <Input
                  id="areaCode"
                  value={formData.areaCode}
                  onChange={(e) => setFormData({ ...formData, areaCode: e.target.value })}
                  className="text-base md:text-lg h-12 md:h-14"
                />
                <Label htmlFor="areaCode" className="text-sm md:text-base text-gray-500 mt-1 block">
                  Area Code
                </Label>
              </div>
              <div>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  required
                  type="tel"
                  className="text-base md:text-lg h-12 md:h-14"
                  placeholder="8500345655"
                />
                <Label htmlFor="phoneNumber" className="text-sm md:text-base text-gray-500 mt-1 block">
                  Phone Number
                </Label>
              </div>
            </div>
          </div>

          <div className="mb-6 md:mb-8">
            <Label htmlFor="email" className="text-base md:text-lg font-medium">
              E-mail <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="mt-2 text-base md:text-lg h-12 md:h-14"
              placeholder="ex: email@yahoo.com"
            />
            <p className="text-sm md:text-base text-gray-500 mt-1">example@example.com</p>
          </div>

          <div className="mb-6 md:mb-8">
            <Label htmlFor="purpose" className="text-base md:text-lg font-medium">
              Select Purpose <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.purpose}
              onValueChange={(value) => setFormData({ ...formData, purpose: value })}
              required
            >
              <SelectTrigger className="mt-2 text-base md:text-lg h-12 md:h-14">
                <SelectValue placeholder="Please Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Inquiry</SelectItem>
                <SelectItem value="school">School Partnership</SelectItem>
                <SelectItem value="parent">Parent Inquiry</SelectItem>
                <SelectItem value="student">Student Enrollment</SelectItem>
                <SelectItem value="support">Technical Support</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mb-6 md:mb-8">
            <Label htmlFor="message" className="text-base md:text-lg font-medium">
              Message: <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required
              className="mt-2 min-h-[120px] md:min-h-[150px] text-base md:text-lg"
              placeholder="Short message (e.g., 'We'd like to schedule a school demo')"
            />
          </div>

          <div className="flex justify-center">
            <Button
              type="submit"
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 px-12 text-lg md:text-xl h-12 md:h-14 rounded-full shadow-lg shadow-blue-600/25 transition-transform hover:scale-105"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
          </Reveal>
        </div>
      </section>

      {/* Connect With Us Section — BLUE */}
      <section className="flex items-center justify-center bg-blue-600 py-12 md:py-16">
        <Reveal className="container">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-3 md:mb-4 max-w-5xl mx-auto text-white text-center">
          Connect <span className="text-amber-300">With Us</span>
        </h2>
        <p className="text-blue-100 mb-6 md:mb-8 max-w-2xl mx-auto text-center text-sm md:text-base lg:text-lg">
          Follow us on social media for updates, tips, and student showcases.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://www.instagram.com/robocoders?igsh=MTJweGVsMzg5M2I3MQ=="
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 hover:opacity-90 hover:scale-110 hover:-translate-y-1 transition-all duration-300 shadow-lg ring-2 ring-white/30"
            aria-label="Instagram"
          >
            <Instagram className="h-6 w-6 text-white" />
          </a>
          <a
            href="https://youtube.com/@robocoders?si=KcRjT1jfLJg7jMkq"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 hover:bg-red-700 hover:scale-110 hover:-translate-y-1 transition-all duration-300 shadow-lg ring-2 ring-white/30"
            aria-label="YouTube"
          >
            <Youtube className="h-6 w-6 text-white" />
          </a>
          <a
            href="https://www.facebook.com/share/1V8yjknAGv/?mibextid=wwXIfr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 hover:scale-110 hover:-translate-y-1 transition-all duration-300 shadow-lg ring-2 ring-white/30"
            aria-label="Facebook"
          >
            <Facebook className="h-6 w-6 text-white" />
          </a>
        </div>
        </Reveal>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}






