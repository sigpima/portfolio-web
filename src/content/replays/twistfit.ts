import type { ReplayDefinition, ReplaySample } from "./types";

/*
 * Twistfit try-on replays.
 *
 * Step details may only contain facts a real `TryOnJob` record holds: occasion,
 * style, the garments chosen, the model photo, the status, and the total time
 * from `created_at` to `updated_at`. Never Flux parameters, prompts or per-step
 * timings (`atMs` below only paces the animation; it is not a measurement).
 *
 * Every sample is `placeholder: true`: the images are abstract SVG stand-ins and
 * the facts (garments, occasion, style, total time) are ILLUSTRATIVE, not from a
 * real job. To swap in a real run, see `public/replays/twistfit/README.md`.
 */

const IMG = "/replays/twistfit";

const nodes: ReplaySample["nodes"] = [
  {
    id: "choose",
    label: { vi: "Chọn đồ", en: "Choose outfit" },
    sublabel: { vi: "dịp · phong cách", en: "occasion · style" },
  },
  {
    id: "flux",
    label: { vi: "Gửi tới Flux API", en: "Send to Flux API" },
    sublabel: { vi: "dịch vụ bên ngoài", en: "external service" },
  },
  {
    id: "result",
    label: { vi: "Ra ảnh kết quả", en: "Result image" },
    sublabel: { vi: "ảnh mặc thử", en: "try-on image" },
  },
];

interface Facts {
  occasion: { vi: string; en: string };
  style: { vi: string; en: string };
  garments: { vi: string; en: string };
  model: { vi: string; en: string };
  totalSeconds: number;
}

/** Same animation pacing for every sample; the details carry the job-record facts only. */
function steps(f: Facts): ReplaySample["steps"] {
  return [
    { atMs: 0, nodeId: "choose", status: "active" },
    {
      atMs: 900,
      nodeId: "choose",
      status: "done",
      detail: {
        vi: `Dịp: ${f.occasion.vi}\nPhong cách: ${f.style.vi}\nMón đồ: ${f.garments.vi}`,
        en: `Occasion: ${f.occasion.en}\nStyle: ${f.style.en}\nGarments: ${f.garments.en}`,
      },
    },
    {
      atMs: 1100,
      nodeId: "flux",
      status: "active",
      detail: {
        vi: `Người mẫu: ${f.model.vi}\nTrạng thái: processing`,
        en: `Model: ${f.model.en}\nStatus: processing`,
      },
    },
    { atMs: 3100, nodeId: "flux", status: "done" },
    { atMs: 3300, nodeId: "result", status: "active" },
    {
      atMs: 3900,
      nodeId: "result",
      status: "done",
      detail: {
        vi: `Trạng thái: done\nTổng thời gian (tạo → cập nhật): ${f.totalSeconds} giây (minh hoạ)`,
        en: `Status: done\nTotal time (created → updated): ${f.totalSeconds} s (illustrative)`,
      },
    },
  ];
}

const model = { src: `${IMG}/model.svg`, alt: { vi: "Ảnh người mẫu (hình bóng giữ chỗ)", en: "Model photo (placeholder silhouette)" } };

export const twistfitReplay: ReplayDefinition = {
  id: "twistfit",
  samples: [
    {
      id: "work-minimal",
      title: { vi: "Đi làm · Tối giản", en: "Work · Minimal" },
      placeholder: true,
      input: {
        kind: "images",
        items: [
          model,
          { src: `${IMG}/garment-shirt.svg`, alt: { vi: "Áo sơ mi trắng (giữ chỗ)", en: "White shirt (placeholder)" } },
          { src: `${IMG}/garment-trousers.svg`, alt: { vi: "Quần âu xám (giữ chỗ)", en: "Grey trousers (placeholder)" } },
        ],
      },
      nodes,
      steps: steps({
        occasion: { vi: "đi làm", en: "work" },
        style: { vi: "tối giản", en: "minimal" },
        garments: { vi: "áo sơ mi trắng, quần âu xám", en: "white shirt, grey trousers" },
        model: { vi: "người mẫu nữ, chính diện", en: "female model, front view" },
        totalSeconds: 42,
      }),
      result: {
        kind: "images",
        items: [
          {
            src: `${IMG}/result-work.svg`,
            alt: {
              vi: "Ảnh kết quả giữ chỗ: người mẫu mặc áo sơ mi trắng và quần âu xám",
              en: "Placeholder result: the model in a white shirt and grey trousers",
            },
          },
        ],
      },
    },
    {
      id: "weekend-casual",
      title: { vi: "Dạo phố cuối tuần · Năng động", en: "Weekend stroll · Casual" },
      placeholder: true,
      input: {
        kind: "images",
        items: [
          model,
          { src: `${IMG}/garment-tshirt.svg`, alt: { vi: "Áo thun màu be (giữ chỗ)", en: "Beige T-shirt (placeholder)" } },
          { src: `${IMG}/garment-jeans.svg`, alt: { vi: "Quần jean xanh đậm (giữ chỗ)", en: "Dark blue jeans (placeholder)" } },
        ],
      },
      nodes,
      steps: steps({
        occasion: { vi: "dạo phố cuối tuần", en: "weekend stroll" },
        style: { vi: "năng động", en: "casual" },
        garments: { vi: "áo thun màu be, quần jean xanh đậm", en: "beige T-shirt, dark blue jeans" },
        model: { vi: "người mẫu nữ, chính diện", en: "female model, front view" },
        totalSeconds: 37,
      }),
      result: {
        kind: "images",
        items: [
          {
            src: `${IMG}/result-weekend.svg`,
            alt: {
              vi: "Ảnh kết quả giữ chỗ: người mẫu mặc áo thun be và quần jean xanh đậm",
              en: "Placeholder result: the model in a beige T-shirt and dark blue jeans",
            },
          },
        ],
      },
    },
    {
      id: "evening-elegant",
      title: { vi: "Tiệc tối · Thanh lịch", en: "Evening party · Elegant" },
      placeholder: true,
      input: {
        kind: "images",
        items: [
          model,
          { src: `${IMG}/garment-dress.svg`, alt: { vi: "Đầm midi xanh navy (giữ chỗ)", en: "Navy midi dress (placeholder)" } },
          { src: `${IMG}/garment-blazer.svg`, alt: { vi: "Áo blazer màu kem (giữ chỗ)", en: "Cream blazer (placeholder)" } },
        ],
      },
      nodes,
      steps: steps({
        occasion: { vi: "tiệc tối", en: "evening party" },
        style: { vi: "thanh lịch", en: "elegant" },
        garments: { vi: "đầm midi xanh navy, áo blazer màu kem", en: "navy midi dress, cream blazer" },
        model: { vi: "người mẫu nữ, chính diện", en: "female model, front view" },
        totalSeconds: 48,
      }),
      result: {
        kind: "images",
        items: [
          {
            src: `${IMG}/result-evening.svg`,
            alt: {
              vi: "Ảnh kết quả giữ chỗ: người mẫu mặc đầm midi xanh navy và áo blazer màu kem",
              en: "Placeholder result: the model in a navy midi dress and a cream blazer",
            },
          },
        ],
      },
    },
  ],
};
