import Airtable from "airtable";
import Image from "next/image";
import { getServerSession } from "next-auth";
import Link from "next/link";

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME!;

export default async function CreditsPage({ params }: any) {
  const session = await getServerSession();
  const carouselId = params.carouselId;

  // Fetch slides for this carousel
  const records = await base(TABLE)
    .select({
      filterByFormula: `{CarouselID} = "${carouselId}"`,
      sort: [{ field: "SlideNumber", direction: "asc" }],
      maxRecords: 100,
    })
    .all();

  if (records.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <h1 className="text-3xl font-bold">Carousel not found</h1>
      </div>
    );
  }

  const slides = records.map((r) => ({
    id: r.id,
    slideNumber: r.get("SlideNumber"),
    image: r.get("GeneratedImageURLs"),
    idea: r.get("Idea") || "",
    optOut: r.get("CreditOptOut"),
    author: r.get("CustomHandle") || r.get("instagram") || "Anonymous",
    userEmail: r.get("Email"),
  }));

  const isOwner = (email: string | null) =>
    session?.user?.email && email === session.user.email;

  return (
    <div className="min-h-screen bg-black text-white px-5 py-10">
      {/* HEADER */}
      <div className="text-center mb-10">
        <Image
          src="/youpost-logo.png"
          width={90}
          height={90}
          alt="YouPost logo"
          className="mx-auto mb-4"
        />
        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-yellow-400 via-pink-500 to-blue-500 bg-clip-text text-transparent">
          Carousel #{carouselId}
        </h1>

        <p className="mt-2 text-neutral-400 text-sm">
          Thank you to all creators who contributed 💜
        </p>
      </div>

      {/* SLIDES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {slides.map((slide) => (
          <div
            key={slide.id}
            className="rounded-3xl p-[2px] bg-gradient-to-br from-yellow-400 via-pink-500 to-blue-500 shadow-xl hover:scale-[1.02] transition-transform"
          >
            <div className="bg-neutral-900 rounded-3xl p-5">
              {/* IMAGE */}
              <Image
                src={String(slide.image || "")}
                width={1024}
                height={1024}
                alt={`Slide ${slide.slideNumber}`}
                className="rounded-2xl border border-neutral-800"
              />

              {/* META */}
              <div className="mt-4">
                <p className="text-sm text-neutral-500">
                  Slide {String(slide.slideNumber ?? "")}
                </p>

                {!slide.optOut ? (
                  <p className="text-lg font-semibold bg-gradient-to-r from-yellow-400 via-pink-500 to-blue-500 bg-clip-text text-transparent">
                    ✨ @{String(slide.author)}
                  </p>
                ) : (
                  <p className="text-lg font-semibold text-neutral-600">
                    (Author removed)
                  </p>
                )}

                <p className="text-sm mt-2 text-neutral-400 italic">
                  {String(slide.idea)}
                </p>
              </div>

              {/* OWNER CONTROLS */}
              {isOwner(String(slide.userEmail)) && (
                <div className="mt-5 space-y-4 border-t border-neutral-800 pt-5">
                  {/* Remove / Restore */}
                  {!slide.optOut ? (
                    <form action="/api/credit/remove" method="POST">
                      <input type="hidden" name="recordId" value={slide.id} />
                      <button className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 transition font-semibold">
                        Remove my credit
                      </button>
                    </form>
                  ) : (
                    <form action="/api/credit/restore" method="POST">
                      <input type="hidden" name="recordId" value={slide.id} />
                      <button className="w-full py-2 rounded-xl bg-green-600 hover:bg-green-700 transition font-semibold">
                        Restore my credit
                      </button>
                    </form>
                  )}

                  {/* Update handle */}
                  <form action="/api/credit/updateHandle" method="POST">
                    <input type="hidden" name="recordId" value={slide.id} />
                    <input
                      type="text"
                      name="handle"
                      defaultValue={String(slide.author)}
                      placeholder="Update handle"
                      className="w-full p-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white focus:ring-2 focus:ring-pink-500 outline-none"
                    />
                    <button className="w-full mt-2 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 transition font-semibold">
                      Update handle
                    </button>
                  </form>

                  {/* Download */}
                  <Link
                    href={`/api/download/${slide.id}`}
                    className="block w-full py-2 rounded-xl text-center font-semibold bg-purple-600 hover:bg-purple-700 transition"
                  >
                    Download my slide
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <p className="text-center text-neutral-600 mt-12 text-sm">
        Built with 💜 by <span className="font-semibold">YouPost</span>
      </p>
    </div>
  );
}
