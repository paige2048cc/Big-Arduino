import svgPaths from "./svg-emwe851b5b";

function Group() {
  return (
    <div className="h-[20px] relative shrink-0 w-[16px]" data-name="Group">
      <div className="absolute inset-[-3.75%_-4.69%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17.5 21.5">
          <g id="Group">
            <path d={svgPaths.p1e626680} id="Vector" stroke="var(--stroke-0, #1E1E1E)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
            <path d={svgPaths.p3dd89cf0} id="Vector_2" stroke="var(--stroke-0, #1E1E1E)" strokeLinejoin="round" strokeWidth="1.5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Frame() {
  return (
    <div className="content-stretch flex gap-[10px] items-center relative shrink-0">
      <Group />
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[normal] not-italic relative shrink-0 text-[18px] text-black">Instructions</p>
    </div>
  );
}

function Group1() {
  return (
    <div className="h-[22.4px] relative shrink-0 w-[24px]">
      <div className="absolute inset-[-0.45%_-0.42%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24.2 22.6004">
          <g id="Group 1171275020">
            <g id="Union">
              <path d={svgPaths.p157cff00} fill="var(--fill-0, black)" />
              <path d={svgPaths.p25846180} fill="var(--stroke-0, black)" />
            </g>
            <path d={svgPaths.p3913ed00} id="Vector" stroke="var(--stroke-0, #1E1E1E)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Frame1() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-[237px]">
      <Frame />
      <Group1 />
    </div>
  );
}

export default function Frame2() {
  return (
    <div className="bg-[#cedbe4] content-stretch flex flex-col items-start px-[13px] py-[16px] relative rounded-[10px] size-full">
      <Frame1 />
    </div>
  );
}