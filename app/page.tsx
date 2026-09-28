import Spotmap from "@/components/spotmap";
import BrandStory from "@/components/brand-story";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <BrandStory />
      <section id="giut-app" aria-label="기웃 지도와 탐험">
        <Spotmap />
      </section>
    </>
  );
}
