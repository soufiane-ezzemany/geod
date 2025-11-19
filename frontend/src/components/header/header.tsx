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
import { getFrenchName } from "@/lib/breadcrumb-mapping"
import React from "react"

export default function Header() {
    const location = useLocation()
    const navigate = useNavigate()
    const pathnames = location.pathname.split("/").filter((x) => x)

    return (
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 bg-white border-b">
            <div className="flex items-center gap-2 px-4">
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
        </header>
    )
}