#!/bin/bash
DASH="============================================================================================================================"
echo " "
echo $DASH
echo "  Docker multi-system BuildX - build and push image to repository"

# check if image name is provided
if [ -z "$1" ]; then
    echo " "
    echo "ERROR: image name is required "
    echo " "
    echo "  Usage:  build_push [image name] [tag] [repository/namespace] "
    echo "  "
    echo "  Parameters:"
    echo "    --- NAME ---     -REQ/OPT-     --------- DESCRIPTION ---------      -- DEFAULT VALUE --"
    echo "    [image name]      Required     Name of the image to be created      N/A"
    echo "    [tag]             Optional     Tag to label the image               latest"
    echo "    [repository]      Optional     Target image repository              docker.io/k8svisual"
    echo " "
    echo $DASH
    echo " "
    exit 1 
else 
    IMG=$1
    echo "  Using provided image name      : $IMG"
fi

# check if tag is provided
if [ -z "$2" ]; then
    TAG="latest"
    echo "  Using default tag              : $TAG"
else 
    TAG=$2
    echo "  Using provided tag             : $TAG"
fi

# TR = target repository
if [ -z "$3" ]; then
    TR="docker.io/k8svisual"
    echo "  Using default image repository : $TR"
else 
    TR=$3
    echo "  Using provided image repository: $TR"
fi

echo $DASH
echo " "

export DOCKER_BUILDKIT=1
docker buildx create --use --name mybuilder --driver docker-container
docker buildx inspect mybuilder --bootstrap
docker buildx build  --platform linux/amd64,linux/arm64 -t ${TR}/${IMG}:${TAG} . --push

# docker push ${TR}/${IMG}:${TAG}
echo " "
echo $DASH
echo " "

