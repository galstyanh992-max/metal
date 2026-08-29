"use client";

import { SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scan, CheckCircle2, Package } from "lucide-react";
import { useState } from "react";

export function WarehousePicks() {
  const [scanned, setScanned] = useState<string>("");

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ընտրման հերթ"
        description="Ընտրեք ապրանքը ցանկից"
      />

      <Card className="border-hairline shadow-none">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 h-12 border-2 border-dashed border-hairline flex items-center px-4 text-muted-foreground">
              <Scan className="size-5 mr-3 text-copper" />
              <input
                value={scanned}
                onChange={(e) => setScanned(e.target.value)}
                placeholder="Սկանավորեք կամ մուտքագրեք կոդը…"
                className="flex-1 bg-transparent outline-none text-sm"
                autoFocus
              />
            </div>
            <Button className="bg-primary gap-2">
              <CheckCircle2 className="size-4" /> Հաստատել
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Ընտրեք պատվերը ցանկից
          </div>
        </CardContent>
      </Card>

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <div className="p-4 border-b border-hairline text-sm font-semibold flex items-center gap-2">
            <Package className="size-4" /> Ընթացիկ ընտրում
          </div>
          <div className="p-8">
            <EmptyState
              title="Ընտրում չի սկսվել"
              description="Սկանավորեք ապրանքը՝ ընտրումը սկսելու համար"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
