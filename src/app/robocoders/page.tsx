import HomeHero from "../../components/public/HomeHero";
import HomeStats from "../../components/public/HomeStats";
import {
} from "../../components/public/HomeSections";
import HomeProgramsLab from "../../components/public/HomeProgramsLab";
import HomeProducts from "../../components/public/HomeProducts";
import HomeJourney from "../../components/public/HomeJourney";
import HomeAudiences from "../../components/public/HomeAudiences";
import HomeFaq from "../../components/public/HomeFaq";
import HomeCta from "../../components/public/HomeCta";
import HomeLms from "../../components/public/HomeLms";
import HomeSchools from "../../components/public/HomeSchools";
import Footer from "../../components/Footer";
import { JsonLd, faqPageJsonLd } from "../../components/seo/JsonLd";
import { FAQS } from "../../components/public/home-faq-data";
import "../../components/public/robo-home.css";
import { display, body } from "./robo-fonts";

export default function RobocodersPage() {
  return (
    <div className={`rh ${display.variable} ${body.variable}`}>
      <JsonLd data={faqPageJsonLd(FAQS.map(({ q, a }) => ({ question: q, answer: a })))} />
      <main>
        <HomeHero />
        <HomeStats />
        <HomeProgramsLab />
        <HomeProducts />
        <HomeLms />
        <HomeJourney />
        <HomeAudiences />
        <HomeSchools />
        <HomeFaq />
        <HomeCta />
      </main>
      <Footer />
    </div>
  );
}
