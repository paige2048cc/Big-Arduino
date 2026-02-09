import svgPaths from "./svg-tfwalaaf5c";

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

function Frame6() {
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
          </g>
        </svg>
      </div>
    </div>
  );
}

function Frame7() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-[267px]">
      <Frame6 />
      <Group1 />
    </div>
  );
}

function Frame8() {
  return (
    <div className="bg-[#fff7d6] content-stretch flex items-center justify-center px-[16px] py-[8px] relative rounded-[10px] shrink-0">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[0] not-italic relative shrink-0 text-[#444] text-[#7c7b7b] text-[14px] tracking-[0.28px]">
        <span className="leading-[20px]">1</span>
        <span className="leading-[20px]">/6</span>
      </p>
    </div>
  );
}

function Frame1() {
  return (
    <div className="bg-[#fff7d6] content-stretch flex flex-col items-center justify-center px-[6px] relative rounded-[10px] shrink-0 size-[20px]">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[14px] text-black tracking-[0.28px]">1</p>
    </div>
  );
}

function Frame2() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0">
      <Frame1 />
    </div>
  );
}

function Frame5() {
  return (
    <div className="bg-[#f4f5f6] content-stretch flex items-center justify-center px-[16px] py-[14px] relative rounded-[10px] shrink-0">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[14px] text-black tracking-[0.28px] w-[236px] whitespace-pre-wrap">Pick out components from the panel to add to your workplace.</p>
    </div>
  );
}

function Frame3() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-[267px]">
      <Frame2 />
      <Frame5 />
    </div>
  );
}

function Frame4() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start overflow-clip relative shrink-0 w-full">
      <Frame3 />
    </div>
  );
}

function Frame10() {
  return (
    <div className="content-stretch flex items-center justify-center px-[16px] py-[8px] relative rounded-[10px] shrink-0">
      <div aria-hidden="true" className="absolute border-2 border-[#1a2bc3] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] not-italic relative shrink-0 text-[#1a2bc3] text-[14px] tracking-[0.28px]">Previous</p>
    </div>
  );
}

function Frame() {
  return (
    <div className="bg-[#1a2bc3] content-stretch flex items-center justify-center px-[16px] py-[8px] relative rounded-[10px] shrink-0">
      <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] not-italic relative shrink-0 text-[#fafafa] text-[14px] tracking-[0.28px]">Next Step</p>
    </div>
  );
}

function Frame12() {
  return (
    <div className="content-stretch flex gap-[10px] items-center justify-end relative shrink-0 w-[267px]">
      <Frame10 />
      <Frame />
    </div>
  );
}

function Frame9() {
  return (
    <div className="content-stretch flex flex-col gap-[25px] items-center justify-center relative shrink-0">
      <Frame7 />
      <Frame8 />
      <Frame4 />
      <Frame12 />
    </div>
  );
}

export default function Frame11() {
  return (
    <div className="bg-[#cedbe4] content-stretch flex items-center p-[24px] relative rounded-[10px] size-full">
      <Frame9 />
    </div>
  );
}