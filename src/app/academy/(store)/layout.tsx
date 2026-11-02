import { display, body } from "../../robocoders/robo-fonts";
import { AcademyFooter, AcademyHeader } from "@/components/academy/AcademyHeader";
import "../../../components/public/robo-home.css";
import "../../../components/public/about.css";
import "../../../components/public/products.css";
import "../../../components/academy/academy.css";

/** Public storefront chrome, in the RoboCoders look (dashboards under /academy/{learn,tutor,admin} have their own). */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rh ${display.variable} ${body.variable}`}>
      <div className="rh-nav">
        <AcademyHeader />
      </div>
      <main className="ac-main">{children}</main>
      <AcademyFooter />
    </div>
  );
}
