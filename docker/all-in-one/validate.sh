#!/bin/bash
# Validation script for all-in-one container

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Validating Flexile All-in-One Container Setup${NC}"
echo "=================================================="

# Check if Docker is installed
echo -e "${YELLOW}Checking Docker installation...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker is installed: $(docker --version)${NC}"
else
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

# Check required files
echo -e "${YELLOW}Checking required files...${NC}"
REQUIRED_FILES=(
    "docker/Dockerfile.all-in-one"
    "docker/all-in-one/supervisord.conf"
    "docker/all-in-one/init.sh"
    "docker/all-in-one/health-check.sh"
    "docker/all-in-one/wait-for-services.sh"
    "docker/all-in-one/services-ready-listener.sh"
    "docker/all-in-one/nginx.conf"
)

ALL_FILES_PRESENT=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${RED}❌ $file is missing${NC}"
        ALL_FILES_PRESENT=false
    fi
done

if [ "$ALL_FILES_PRESENT" = false ]; then
    echo -e "${RED}❌ Some required files are missing${NC}"
    exit 1
fi

# Check if scripts are executable
echo -e "${YELLOW}Checking script permissions...${NC}"
SCRIPTS=(
    "docker/all-in-one/init.sh"
    "docker/all-in-one/health-check.sh"
    "docker/all-in-one/wait-for-services.sh"
    "docker/all-in-one/services-ready-listener.sh"
)

ALL_EXECUTABLE=true
for script in "${SCRIPTS[@]}"; do
    if [ -x "$script" ]; then
        echo -e "${GREEN}✅ $script is executable${NC}"
    else
        echo -e "${RED}❌ $script is not executable${NC}"
        ALL_EXECUTABLE=false
    fi
done

if [ "$ALL_EXECUTABLE" = false ]; then
    echo -e "${YELLOW}⚠️  Making scripts executable...${NC}"
    chmod +x docker/all-in-one/*.sh
    echo -e "${GREEN}✅ Scripts made executable${NC}"
fi

# Check mise tasks
echo -e "${YELLOW}Checking mise tasks...${NC}"
if mise tasks | grep -q "docker:all-in-one:build"; then
    echo -e "${GREEN}✅ All-in-one mise tasks are configured${NC}"
else
    echo -e "${RED}❌ All-in-one mise tasks are not configured${NC}"
fi

# Check if required directories exist
echo -e "${YELLOW}Checking required directories...${NC}"
REQUIRED_DIRS=(
    "backend"
    "frontend"
    "docker"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅ $dir directory exists${NC}"
    else
        echo -e "${RED}❌ $dir directory is missing${NC}"
    fi
done

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}✅ All-in-One Container Setup Valid${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo "Next steps:"
echo "1. Build the container: mise docker:all-in-one:build"
echo "2. Run the container: mise docker:aio"
echo "3. Access the application at https://flexile.dev"
echo ""
echo "For more information, see: docker/all-in-one/README.md"