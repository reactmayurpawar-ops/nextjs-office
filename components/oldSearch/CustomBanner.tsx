import React from 'react';


interface BannerProps {
  message?: string;
}

const CustomSearchBanner: React.FC<BannerProps> = ({ message }) => {
  if(!message)
  {
    return null;
  }

  return (
    <div className="container flex flex-col md:flex-row items-center justify-center lg:justify-left  gap-2 md:gap-16 bg-yellow-200 text-black pl-8">
      <span className="mr-2 text-[20px] text-black">⚠️</span>
      <span className="text-sm font-semibold">{message}</span>
    </div>
  );
};

export default CustomSearchBanner;
