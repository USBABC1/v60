
"use client";
import { useEffect } from "react";
import createStudioEditor from "@grapesjs/studio-sdk";
import {
  listPagesComponent,
  fsLightboxComponent,
  lightGalleryComponent,
  swiperComponent,
  iconifyComponent,
  accordionComponent,
  flexComponent,
  rteTinyMce,
  canvasEmptyState,
  canvasFullSize,
  layoutSidebarButtons,
  youtubeAssetProvider
} from "@grapesjs/studio-sdk-plugins";
import "@grapesjs/studio-sdk/style";

const BuilderStudio = () => {
  useEffect(() => {
    createStudioEditor({
      root: "#studio-editor",
      licenseKey: "a588bab57a26417d829a73e27616d0233b3b7ba518ea4156a72f28517c14f616",
      theme: "dark",
      project: { type: "web" },
      storage: {
        type: "self",
        autosaveChanges: 100,
        autosaveIntervalMs: 10000,
        onSave: async ({ project }) => {
          const res = await fetch("/api/save-project", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(project),
          });
          console.log("[STUDIO] Saved:", await res.json());
        },
        onLoad: async () => {
          const res = await fetch("/api/load-project");
          return { project: await res.json() };
        }
      },
      assets: {
        storageType: "self",
        onUpload: async ({ files }) => {
          const body = new FormData();
          for (const file of files) {
            body.append("files", file);
          }
          const res = await fetch("/api/save-assets", { method: "POST", body });
          return await res.json();
        },
        onDelete: async ({ assets }) => {
          const res = await fetch("/api/delete-assets", {
            method: "DELETE",
            body: JSON.stringify(assets),
          });
          return await res.json();
        }
      },
      plugins: [
        listPagesComponent.init({}),
        fsLightboxComponent.init({}),
        lightGalleryComponent.init({}),
        swiperComponent.init({}),
        iconifyComponent.init({}),
        accordionComponent.init({}),
        flexComponent.init({}),
        rteTinyMce.init({}),
        canvasEmptyState.init({}),
        canvasFullSize.init({}),
        layoutSidebarButtons.init({}),
        youtubeAssetProvider.init({})
      ]
    });
  }, []);

  return <div id="studio-editor" className="h-full w-full" />;
};

export default BuilderStudio;
