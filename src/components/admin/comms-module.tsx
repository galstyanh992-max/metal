"use client";

import { SectionHeader, EmptyState } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MessageCircle, Send, Inbox } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export function CommsModule() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Հաղորդակցություն"
        description="Էլ․ փոստ և WhatsApp"
        action={<Button size="sm" className="gap-2 bg-primary"><Send className="size-4" /> Նոր հաղորդագրություն</Button>}
      />

      <Tabs defaultValue="email">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="email" className="text-xs gap-1.5"><Mail className="size-3.5" /> Էլ․ փոստ</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs gap-1.5"><MessageCircle className="size-3.5" /> WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4">
          <Card className="border-hairline shadow-none">
            <CardContent className="p-8">
              <EmptyState
                title="Էլ․ փոստի մատյան"
                description="Այստեղ կհայտնվեն ուղարկված և ստացված նամակները։ Մինչ կարգավորումը՝ օգտագործեք AI Օգնականի email մոդուլը սևագրերի համար։"
                action={<Button variant="outline" size="sm" className="gap-2"><Inbox className="size-4" /> Թարմացնել</Button>}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <Card className="border-hairline shadow-none">
            <CardContent className="p-8">
              <EmptyState
                title="WhatsApp Business"
                description="Պահանջվում է WhatsApp Business API token-ի կարգավորում։ Մինչ այդ՝ AI Օգնականը կարող է սևագրել հաղորդագրություններ։"
                action={<Button variant="outline" size="sm" className="gap-2"><MessageCircle className="size-4" /> Կարգավորել</Button>}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
