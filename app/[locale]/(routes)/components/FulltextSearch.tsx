"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const FulltextSearch = () => {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const handleSearch = async () => {
    router.push(`/fulltext-search?q=${search}`);
    setSearch("");
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSearch();
      }}
      className="flex min-w-0 w-full flex-1 items-center space-x-2"
    >
      <Input
        type="text"
        className="min-w-0 flex-1"
        placeholder={"Search something ..."}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Button type="submit" className="shrink-0 gap-2">
        <span className="hidden sm:flex">Search</span>
        <SearchIcon />
      </Button>
    </form>
  );
};

export default FulltextSearch;
