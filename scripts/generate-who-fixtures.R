# Reference process only; source and tables are never bundled with the app.
# Run: R --vanilla --slave -f scripts/generate-who-fixtures.R --args /path/to/pinned/anthro /output/directory
args <- commandArgs(trailingOnly=TRUE)
root <- args[[1]]; output <- args[[2]]
load(file.path(root, "R", "sysdata.rda"))
collate <- read.dcf(file.path(root, "DESCRIPTION"))[[1,"Collate"]]
files <- gsub("'", "", strsplit(gsub("\\s+", " ", collate), " ")[[1]])
for (file in files[nzchar(files)]) source(file.path(root,"R",file))
rows <- list(); j <- 1L
for (indicator in c("WAZ", "LAZ", "WLZ", "HCZ")) {
  for (sex in c(1, 2)) {
    indices <- if (indicator == "WLZ") c(45, 45.1, 50.05, 60, 100.03, 110) else c(0, 1, 100, 273, 730, 731)
    for (index in indices) {
      table <- switch(indicator, WAZ=growthstandards_weianthro, LAZ=growthstandards_lenanthro, WLZ=growthstandards_wflanthro, HCZ=growthstandards_hcanthro)
      if (indicator == "WLZ") {
        low <- trunc(index*10)/10; high <- trunc(index*10+1)/10; fraction <- (index-low)/0.1
        a <- table[table$sex==sex & table$length==low, ]
        b <- table[table$sex==sex & table$length==high, ]
        coef <- if(fraction > 0) c(a$l + fraction*(b$l-a$l), a$m + fraction*(b$m-a$m), a$s + fraction*(b$s-a$s)) else c(a$l,a$m,a$s)
      } else { a <- table[table$sex==sex & table$age==index, ]; coef <- c(a$l,a$m,a$s) }
      for (target in c(-7,-3.5,0,3.5,7)) {
        l <- coef[1]; m <- coef[2]; s <- coef[3]
        base <- 1 + l*s*target
        if (base <= 0) next
        x <- m*base^(1/l)
        raw <- if(indicator %in% c("WAZ","WLZ")) compute_zscore_adjusted(x,m,l,s) else compute_zscore(x,m,l,s)
        z <- round(raw,2)
        flag <- if(indicator=="WAZ") z < -6 || z > 5 else if(indicator=="LAZ") abs(z)>6 else abs(z)>5
        rows[[j]] <- data.frame(indicator,sex,index,L=l,M=m,S=s,x,zReference=z,flag=as.integer(flag),centile=100*pnorm(z)); j <- j+1L
      }
    }
  }
}
# Independently exercise both strict flag limits, including values that round
# back onto the limit and values that round outside it. Invert the documented
# restricted tail only to construct inputs; expected scores still use official R.
for (indicator in c("WAZ","LAZ","WLZ","HCZ")) for (sex in c(1,2)) {
  index <- if(indicator == "WLZ") 50 else 100
  table <- switch(indicator, WAZ=growthstandards_weianthro, LAZ=growthstandards_lenanthro, WLZ=growthstandards_wflanthro, HCZ=growthstandards_hcanthro)
  a <- if(indicator == "WLZ") table[table$sex==sex & table$length==index,] else table[table$sex==sex & table$age==index,]
  l <- a$l; m <- a$m; s <- a$s
  curve <- function(z) if(l==0) m*exp(s*z) else m*(1+l*s*z)^(1/l)
  low <- if(indicator %in% c("WAZ","LAZ")) -6 else -5
  high <- if(indicator == "LAZ") 6 else 5
  for(target in c(low-.006,low-.004,low,low+.004,high-.004,high,high+.004,high+.006)) {
    x <- if(indicator %in% c("WAZ","WLZ") && target>3) curve(3)+(target-3)*(curve(3)-curve(2)) else if(indicator %in% c("WAZ","WLZ") && target< -3) curve(-3)+(target+3)*(curve(-2)-curve(-3)) else curve(target)
    raw <- if(indicator %in% c("WAZ","WLZ")) compute_zscore_adjusted(x,m,l,s) else compute_zscore(x,m,l,s)
    z <- round(raw,2); flag <- z < low || z > high
    rows[[j]] <- data.frame(indicator,sex,index,L=l,M=m,S=s,x,zReference=z,flag=as.integer(flag),centile=100*pnorm(z)); j <- j+1L
  }
}
write.csv(do.call(rbind, rows), file.path(output,"who-lms-oracle.csv"), row.names=FALSE)
# Full official normalization/availability results, separately from app-specific gates.
inputs <- data.frame(sex=c(1,2,1,2,1,2,1,2,1,2), age=c(0,100,273,274,730,731,100,100,100,100), weight=c(3.5,6,8,8,12,12,0,NA,6,6), lenhei=c(50,60,70,70,90,90,60,60,60,60), measure=c('l','h','h','h','h','l','l','l','l',NA), oedema=c('n','n','n','n','n','n','n','n','y','n'), headc=rep(40,10))
results <- anthro_zscores(inputs$sex, inputs$age, weight=inputs$weight, lenhei=inputs$lenhei, measure=inputs$measure, oedema=inputs$oedema, headc=inputs$headc)
write.csv(cbind(inputs,results),file.path(output,"who-normalization-oracle.csv"),row.names=FALSE,na="")
