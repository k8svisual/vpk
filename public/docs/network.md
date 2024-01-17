<topicKey network/>
<topicBack id="topicNext" link="security"/>
<topicNext id="topicBack" link="storage"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Network (tab)

Network tab provides two views of the related network IPs and components. 

### Node & Pod IPs

The default view when opening the tab is the Node & Pod IPs.  This view provides the node IP along with the Pod IP ranges that are in use within the associated Pods. 

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_network_nodes.png" width="1024">
</p>

Click the node icon to view node related information.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_network_nodes_detail2.png">
</p>

Click the Pod IP ranges to view a tabular view of the Pod and associated IPs.  Once displayed click any of the rows to view the  associated resource definition.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_network_nodes_detail.png">
</p>

<hr style="border:1px solid #aaaaaa">

### Services-To-Pods

The second view is the Services-To-Pods view.  This is a view of the Service to the associated Node and Pods.  Click any of the icons or text to view the related resource definition.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_network_services.png" width="1024">
</p>

<hr style="border:1px solid #aaaaaa">

### Filter view

Each view can have a filter applied.  Press the __Filter__ button to open the filter capability.  Once open, select the type of filter to be applied. This will populate the second drop down __Filter data__.  From this drop down select the associated data for the selected filter type.  Press the button labeled __Apply filter__ and the filter will be applied and the filter screen closed.

The drop down for the filter type will have different options based on the view.  

The Node & Pod IPs view has two filter types: 

- Node name 
- Node ip  

The Services-To-Pod view has five filter types: 

-	Service name
-	Service ip
-	Pod name 
-	Pod ip 
-	Namespace

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_network_filter.png" width="1024">
</p>

<hr style="border:1px solid #aaaaaa">



