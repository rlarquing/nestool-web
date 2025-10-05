import * as React from "react"
import { GalleryVerticalEnd } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"

// This is sample data.
const data = {
  navMain: [
    {
      title: "Trabajo con Entity",
      url: "#",
      items: [
        {
          title: "Nueva entity",
          url: "/nueva-entity",
        },
        {
          title: "Editar entity",
          url: "/editar-entity",
        },
        {
          title: "Crear un nomenclador",
          url: "/crear-nomenclador",
        },
      ],
    },
    {
      title: "Trabajo con DTOs",
      url: "#",
      items: [
        {
          title: "Nuevo DTO",
          url: "/nuevo-dto",
        },
        {
          title: "DTOs para un CRUD",
          url: "/dto-crud",
          isActive: true,
        },
      ],
    },
    {
      title: "Creación de ficheros",
      url: "#",
      items: [
        {
          title: "Crear un controlador",
          url: "'/crear-controlador",
        },
        {
          title: "Crear un service",
          url: "/crear-service",
        },
        {
          title: "Crear un mapper",
          url: "/crear-mapper",
        },
        {
          title: "Crear un repository",
          url: "/crear-repository",
        },
        {
          title: "Crear un CRUD completo",
          url: "/crear-crud-completo",
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <GalleryVerticalEnd className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Nestool-web</span>
                  <span className="">v1.0.0</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <a href={item.url} className="font-medium">
                    {item.title}
                  </a>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <SidebarMenuSub>
                    {item.items.map((item) => (
                      <SidebarMenuSubItem key={item.title}>
                        <SidebarMenuSubButton asChild isActive={item.isActive}>
                          <a href={item.url}>{item.title}</a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
