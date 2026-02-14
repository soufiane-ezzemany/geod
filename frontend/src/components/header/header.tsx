import { useLocation, useNavigate } from "react-router"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from "@/components/ui/breadcrumb"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { getFrenchName } from "@/lib/breadcrumb-mapping"
import { BACKEND_URL } from "@/config"
import { BookText } from "lucide-react"
import React from "react"

export default function Header() {
    const location = useLocation()
    const navigate = useNavigate()
    const pathnames = location.pathname.split("/").filter((x) => x)

    return (
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 bg-white border-b px-4">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <Breadcrumb>
                    <BreadcrumbList>
                        {pathnames.map((value, index) => {
                            const to = `/${pathnames.slice(0, index + 1).join("/")}`
                            const isLast = index === pathnames.length - 1
                            const displayName = getFrenchName(value)
                            return (
                                <React.Fragment key={to}>
                                    <BreadcrumbItem>
                                        {isLast ? (
                                            <BreadcrumbPage className="font-medium">{displayName}</BreadcrumbPage>
                                        ) : (
                                            <BreadcrumbLink className="hover:cursor-pointer" onClick={() => navigate(to)}>
                                                {displayName}
                                            </BreadcrumbLink>
                                        )}
                                    </BreadcrumbItem>
                                    {!isLast && <BreadcrumbSeparator />}
                                </React.Fragment>
                            )
                        })}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                    <a href={`${BACKEND_URL}/apidocs`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                        <BookText className="h-4 w-4" />
                        <span className="hidden md:inline">API Docs</span>
                    </a>
                </Button>
            </div>
        </header>
    )
}